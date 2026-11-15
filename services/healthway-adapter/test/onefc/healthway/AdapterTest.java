package onefc.healthway;
import java.util.*;
import java.nio.file.*;
import java.nio.charset.StandardCharsets;
import java.io.*;
import java.net.*;
import com.sun.net.httpserver.HttpServer;
import com.fasterxml.jackson.databind.*;
public final class AdapterTest {
    static int count=0;
    static void check(boolean ok,String title){if(!ok)throw new AssertionError(title);count++;}
    public static void main(String[] args) throws Exception {
        PrintStream result=System.out;System.setOut(new PrintStream(OutputStream.nullOutputStream()));
        OfflineHealthwayProvider p=new OfflineHealthwayProvider(Collections.emptyMap());
        Map<String,String> expected=new LinkedHashMap<>();expected.put("0206","2001");expected.put("0207","2002");expected.put("0219","2004");expected.put("0205","1004");
        for(Map.Entry<String,String> e:expected.entrySet()) {
            String search=e.getKey().equals("0205") ? "{\"utilizationUserNo\":\"MOCK\",\"careInstitutionSign\":\"MOCK\",\"beginningDate\":\"2023-01-01\",\"endDate\":\"2024-12-31\",\"datasetCodeList\":[\"1004\",\"1010\"],\"apiType\":\"02\"}" :
                e.getKey().equals("0207") ? "{\"utilizationUserNo\":\"MOCK\",\"beginningDate\":\"2023-04-01\",\"endDate\":\"2024-04-01\",\"apiType\":\"02\"}" :
                "{\"utilizationUserNo\":\"MOCK\",\"apiType\":\"02\",\"sensitiveInformationProvisionYn\":\"Y\"}";
            JsonNode r=p.call(e.getKey(),Json.M.readTree("{\"args\":["+search+"]}"));
            check(r.path("records").size()>0,e.getKey()+" records");
            JsonNode first=r.path("records").get(0);check(first.path("datasetCode").asText().equals(e.getValue()),"dataset");check(first.has("rawResource"),"traceability");
            if(e.getKey().equals("0207")){check(!first.has("kcdCodeRaw"),"no invented diagnosis");check(first.has("visitHospitalDays"),"EOB code.text");check(!first.path("institution").path("identifiers").isEmpty(),"facility ID");}
            if(e.getKey().equals("0219")){check(first.path("drugCodeRaw").asText().equals("052401990"),"preserve KD leading zero");check(first.path("ingredients").size()>0,"ingredient");}
            if(e.getKey().equals("0205")){check(first.path("kcdSystem").asText().equals(FhirNormalizer.KCD),"KCD system");check(first.has("encounterPeriod"),"Encounter reference");}
            result.println("PASS PG-SDK-"+e.getKey()+" normalized="+r.path("records").size());
        }
        check(p.call("0005",Json.M.readTree("{\"args\":[null]}")).path("data").isArray(),"0005");
        JsonNode cert=p.call("0201",Json.M.readTree("{\"args\":[\"MOCK\",\"MOCK\"]}"));
        check(cert.path("data").path("match").asBoolean(),"0201 official decrypt offline sample");
        check(cert.path("data").path("mymdResult").asText().equals("200"),"0201 case1");
        check(p.call("0199",Json.M.readTree("{\"args\": [{\"utilizationUserNo\": \"MOCK\", \"provideInstitutionNo\": \"100002\", \"datasetCodeList\": [\"2001\", \"2002\"], \"consent\": \"MOCK offline consent\", \"agreementDate\": \"2024-01-01\", \"transmissionDemandAgreementEndDate\": \"2024-12-31\", \"holdUtilizationPeriod\": \"2024-12-31\", \"regularTransferYN\": \"N\", \"transmissionDemandPurpose\": \"MOCK offline test\", \"utilizationUserName\": \"MOCK\", \"siteTxId\": \"MOCK\", \"txId\": \"MOCK\", \"caCode\": \"MOCK\", \"contentId\": \"MOCK\", \"signedContent\": \"MOCK\", \"userIp\": \"127.0.0.1\", \"signClientId\": \"MOCK\", \"connectingInformation\": \"MOCK\", \"thirdPartyProvisionAgreementYN\": \"N\"}]}")).path("data").has("accessToken"),"0199 official sample");
        check(p.call("0221",Json.M.readTree("{\"mockAuthPath\":\"/health-connect/abcdefghijklmnopqrstuvwxyz012345678901234567890/mock-auth\",\"demandDealingsNo\":\"MOCK\"}")).path("mock").asBoolean(),"0221 explicit mock");
        try{p.call("0200",Json.M.readTree("{}"));throw new AssertionError();}catch(IllegalArgumentException ex){count++;}
        // Doc-shaped test fixture only, no official Procedure sample exists. Medical standard §3.14 pp42–43.
        String proc="{\"resourceType\":\"Bundle\",\"type\":\"collection\",\"entry\":[{\"resource\":{\"resourceType\":\"Procedure\",\"id\":\"test-procedure\",\"status\":\"completed\",\"code\":{\"coding\":[{\"system\":\"http://www.hl7korea.or.kr/CodeSystem/hira-edi-procedure\",\"code\":\"TEST_ONLY\"}]},\"performedDateTime\":\"2024-01-01\",\"encounter\":{\"reference\":\"Encounter/test-enc\"}}},{\"resource\":{\"resourceType\":\"Encounter\",\"id\":\"test-enc\",\"status\":\"finished\",\"class\":{\"system\":\"http://terminology.hl7.org/CodeSystem/v3-ActCode\",\"code\":\"IMP\"},\"period\":{\"start\":\"2024-01-01\",\"end\":\"2024-01-08\"}}}]}";
        JsonNode surgery=new FhirNormalizer(Paths.get("sample-data/esi-names.json")).parse(proc).get(0);
        check(surgery.path("datasetCode").asText().equals("1010"),"1010 parser");check(surgery.path("encounterClass").path("code").asText().equals("IMP"),"1010 encounter");
        String secret=UUID.randomUUID().toString();HmacAuth auth=new HmacAuth(secret);byte[] body="{}".getBytes(StandardCharsets.UTF_8);String ts="1000",nonce="test_nonce_0000001";
        String sig=HmacAuth.sign(secret,"POST","/sdk/0005",ts,nonce,body);
        check(!auth.verify("POST","/sdk/0005",ts,nonce,sig,body,1301),"skew");
        check(!auth.verify("POST","/sdk/0005",ts,nonce,"0".repeat(64),body,1000),"bad signature");
        check(auth.verify("POST","/sdk/0005",ts,nonce,sig,body,1000),"valid signature");
        check(!auth.verify("POST","/sdk/0005",ts,nonce,sig,body,1000),"replay");
        try{Providers.select(Collections.singletonMap("HEALTHWAY_PROVIDER","production"));throw new AssertionError();}catch(IllegalStateException ex){count++;}
        try{Providers.select(Collections.singletonMap("HEALTHWAY_PROVIDER","testbed")).call("0005",Json.M.readTree("{}"));throw new AssertionError();}catch(IllegalStateException ex){count++;}
        try{new HmacAuth(null);throw new AssertionError();}catch(IllegalArgumentException ex){count++;}
        check(new OfflineMockSignatureProvider().sign(Json.M.readTree("{}")).path("mock").asBoolean(),"signature mock");
        HttpServer server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);
        HmacAuth httpAuth=new HmacAuth(secret);server.createContext("/",e->Main.handle(e,httpAuth,p));server.start();
        try {
            String base="http://127.0.0.1:"+server.getAddress().getPort();
            HttpURLConnection health=(HttpURLConnection)new URL(base+"/healthz").openConnection();
            check(health.getResponseCode()==200,"healthz no authentication");
            JsonNode healthData=Json.M.readTree(health.getInputStream());check(healthData.size()==4 && healthData.path("sdkVersion").asText().equals("0.2.8-SNAPSHOT"),"healthz minimal contract");health.disconnect();
            byte[] payload="{\"args\":[null]}".getBytes(StandardCharsets.UTF_8);
            String timestamp=String.valueOf(System.currentTimeMillis()/1000), requestNonce="HTTP_TEST_NONCE_0001";
            String signature=HmacAuth.sign(secret,"POST","/sdk/0005",timestamp,requestNonce,payload);
            check(http(base,payload,timestamp,requestNonce,"0".repeat(64))==401,"HTTP bad signature");
            check(http(base,payload,timestamp,requestNonce,signature)==200,"HTTP authenticated SDK");
            check(http(base,payload,timestamp,requestNonce,signature)==401,"HTTP replay");
            check(http(base,payload,"1","HTTP_OLD_NONCE_0001",signature)==401,"HTTP skew");
        }finally{server.stop(0);}
        try{Providers.select(Collections.singletonMap("HEALTHWAY_PROVIDER","invalid"));throw new AssertionError();}catch(IllegalArgumentException ex){count++;}
        Map<String,String> prod=new HashMap<>();prod.put("HEALTHWAY_PROVIDER","production");prod.put("HEALTHWAY_ALLOW_PRODUCTION","true");
        try{Providers.select(prod).call("0005",Json.M.readTree("{}"));throw new AssertionError();}catch(IllegalStateException ex){count++;}
        result.println("Java assertions passed: "+count);
    }
    static int http(String base,byte[] body,String ts,String nonce,String signature) throws Exception {
        HttpURLConnection c=(HttpURLConnection)new URL(base+"/sdk/0005").openConnection();c.setRequestMethod("POST");c.setDoOutput(true);
        c.setRequestProperty("X-Healthway-Timestamp",ts);c.setRequestProperty("X-Healthway-Nonce",nonce);c.setRequestProperty("X-Healthway-Signature",signature);
        c.getOutputStream().write(body);int code=c.getResponseCode();c.disconnect();return code;
    }
}
