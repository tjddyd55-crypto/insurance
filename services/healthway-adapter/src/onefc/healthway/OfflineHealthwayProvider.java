package onefc.healthway;
import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.*;
import mymd.plfm.sdk.common.MymdServiceFactory;
import mymd.plfm.sdk.common.dto.auth.*;
import java.lang.reflect.*;
import java.nio.file.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import org.hl7.fhir.r4.model.Bundle;

/** Explicit PG-SDK allowlist from javap, not arbitrary reflection or invented upstream APIs. */
public final class OfflineHealthwayProvider implements HealthwayProvider {
    private final Map<String,String> methods = new LinkedHashMap<>();
    private final FhirNormalizer normalizer;
    public OfflineHealthwayProvider(Map<String,String> env) throws Exception {
        Path samples = Paths.get(env.getOrDefault("HEALTHWAY_SAMPLE_DATA_DIR", "sample-data")).toAbsolutePath();
        if (!Files.isDirectory(samples)) throw new IllegalStateException("Official offline sample directory missing");
        Path runtime = Paths.get("runtime"); Files.createDirectories(runtime);
        // Only these two settings; no credentials or fake production properties.
        String path = samples.toString().replace("\\", "/") + "/";
        Files.write(runtime.resolve("mymd.properties"), ("mymd.mode=offline\nmymd.datapath=" + path + "\n").getBytes(StandardCharsets.UTF_8));
        normalizer = new FhirNormalizer(samples.resolve("esi-names.json"));
        String[][] pairs = {
            {"0003","findTermsList"},{"0005","findDatasetList4Utilization"},
            {"0187","findPublicProvideInstitutionList"},{"0220","findUnityTermsList"},
            {"0221","findUnitySubscription4Certification"},{"0201","findDecryptDataBySubscriptionCertification"},
            {"0051","createPlatformRetraction"},{"0002","sanctionUser"},{"0034","sanctionManager"},
            {"0096","findUtilizationUserAccountStatusByUserNo"},{"0008","cancelUtilization"},
            {"0010","findTermsAgreementStatusList"},{"0011","modifyTermsAgreement4Provision"},
            {"0012","createDatasetAgreement4Utilization"},{"0013","modifyDatasetAgreement4Utilization"},
            {"0014","findDatasetAgreementStatusList4Utilization"},
            {"0199","createDemandAgreementAndToken"},{"0203","createDemandAgreementAndTokenRecantation"},
            {"0190","createDemandAgreementRecantation"},{"0215","findTransmissionDemandList"},
            {"0204","createTransmissionTokenByRefreshToken"},
            {"0206","findDemandTokenDiagnosticReportByUserNo"},
            {"0207","findDemandTokenExplanationOfBenefitByUserNo"},
            {"0219","findDemandTokenMedicationDispenseSensitiveInformationByUserNo"},
            {"0205","findDemandTokenMedicalDataByProvideInstitution"}
        };
        for (String[] p : pairs) methods.put(p[0],p[1]);
    }
    public String name() { return "offline"; }
    public JsonNode call(String id, JsonNode request) throws Exception {
        if (!methods.containsKey(id)) throw new IllegalArgumentException("UNSUPPORTED PG-SDK method");
        if ("0221".equals(id)) {
            // No official 0221 offline file. Do not call deprecated 0200 or disguise its sample as 0221.
            ObjectNode out = Json.M.createObjectNode(); out.put("mock",true);
            out.put("label","MOCK — 0221 공식 오프라인 샘플 없음");
            String url = request.path("mockAuthPath").asText();
            if (!url.matches("/health-connect/[A-Za-z0-9_-]{43,}/mock-auth")) throw new IllegalArgumentException("DEV mock path required");
            out.put("apiUrl",url); out.put("demandDealingsNo",request.path("demandDealingsNo").asText());
            return out;
        }
        Object service = id.matches("001[0-4]") ? MymdServiceFactory.getMymdAgreementServiceInstance() :
            id.matches("0199|0203|0190|0215|0204|0206|0207|0219|0205") ?
            MymdServiceFactory.getMymdTransmissionServiceInstance() : MymdServiceFactory.getMymdSupportServiceInstance();
        Method method = null;
        // Invoke through the public SDK interface (implementation can be package private).
        for (Class<?> iface : service.getClass().getInterfaces())
            for (Method m : iface.getMethods()) if (m.getName().equals(methods.get(id))) method=m;
        if (method == null) throw new IllegalStateException("SDK method not found");
        java.lang.reflect.Type[] types = method.getGenericParameterTypes();
        Object[] args = new Object[types.length]; int offset=0;
        if (types.length>0 && types[0].getTypeName().contains("common.dto.auth.Mymd") && !"0201".equals(id)) {
            Object auth = ((Class<?>)types[0]).getDeclaredConstructor().newInstance();
            // Values generated for the SDK's OFFLINE signature only. Never real credentials; no state retained.
            String mock = "MOCK-" + UUID.randomUUID();
            auth.getClass().getMethod("setToken",String.class).invoke(auth,request.path("token").asText(mock));
            auth.getClass().getMethod("setMymdEncryptionKey",MymdEncryptionKeyDTO.class)
                .invoke(auth,new MymdEncryptionKeyDTO(mock,mock));
            args[0]=auth; offset=1;
        }
        JsonNode params=request.path("args");
        if (!params.isArray() || params.size()!=types.length-offset) throw new IllegalArgumentException("Wrong SDK argument count");
        for (int i=offset;i<types.length;i++) args[i]=Json.M.convertValue(params.get(i-offset),Json.M.constructType(types[i]));
        Object result;
        try { result=method.invoke(service,args); }
        catch (InvocationTargetException ex) { throw new IllegalStateException("SDK offline call failed: PG-SDK-"+id); }
        ObjectNode envelope=Json.M.createObjectNode(); envelope.put("mock",true); envelope.put("provider","offline"); envelope.put("sdkId",id);
        if (result instanceof Bundle) envelope.set("records",normalizer.normalize((Bundle)result));
        else envelope.set("data",Json.M.valueToTree(result));
        return envelope;
    }
}
