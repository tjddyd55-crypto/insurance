package onefc.healthway;
import ca.uhn.fhir.context.FhirContext;
import org.hl7.fhir.r4.model.Bundle;
import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.*;
import java.nio.file.*;
import java.util.*;

/** Adapter contract v1. Fields below are OUR contract; upstream field access follows official R4 profiles. */
public final class FhirNormalizer {
    public static final String KCD="http://www.hl7korea.or.kr/CodeSystem/kostat-kcd-8";
    private final FhirContext fhir=FhirContext.forR4();
    private final JsonNode esi;
    public FhirNormalizer(Path names) throws Exception { esi=Files.isRegularFile(names)?Json.M.readTree(names.toFile()):Json.M.createObjectNode(); }
    public ArrayNode normalize(Bundle bundle) throws Exception {
        return normalizeTree(Json.M.readTree(fhir.newJsonParser().encodeResourceToString(bundle)));
    }
    public ArrayNode parse(String json) throws Exception {
        return normalize((Bundle)fhir.newJsonParser().parseResource(json));
    }
    private void collect(JsonNode node,List<JsonNode> resources,Map<String,JsonNode> index) {
        if (!node.isObject()) return;
        String type=node.path("resourceType").asText(), id=node.path("id").asText();
        if (!type.isEmpty() && !"Bundle".equals(type)) {
            resources.add(node);
            if (!id.isEmpty()) index.put(type+"/"+id,node);
        }
        for (JsonNode entry:node.path("entry")) {
            JsonNode r=entry.path("resource");
            if (entry.has("fullUrl")) index.put(entry.path("fullUrl").asText(),r);
            collect(r,resources,index);
        }
    }
    private JsonNode resolve(JsonNode reference,JsonNode parent,Map<String,JsonNode> index) {
        String ref=reference.path("reference").asText();
        for (JsonNode r:parent.path("contained")) {
            if (ref.equals("#"+r.path("id").asText()) || ref.equals(r.path("resourceType").asText()+"/"+r.path("id").asText())) return r;
        }
        return index.getOrDefault(ref,Json.M.createObjectNode());
    }
    private JsonNode coding(JsonNode node) { return node.path("coding").path(0); }
    private String code(JsonNode node) { return coding(node).path("code").asText(); }
    private void field(ObjectNode n,String key,JsonNode v) { if (!v.isMissingNode() && !v.isNull()) n.set(key,v); }
    private JsonNode facility(JsonNode r,JsonNode ref,Map<String,JsonNode> index) {
        JsonNode org=resolve(ref,r,index); ObjectNode out=Json.M.createObjectNode();
        field(out,"name",org.path("name")); field(out,"address",org.path("address")); field(out,"identifiers",org.path("identifier"));
        field(out,"reference",ref.path("reference")); return out;
    }
    private Double number(JsonNode node) {
        try { double n=Double.parseDouble(node.asText()); return Double.isFinite(n)?n:null; } catch(Exception ex) { return null; }
    }
    private void items(JsonNode r,ArrayNode out) {
        String type=r.path("resourceType").asText();
        if ("Observation".equals(type)) {
            String c=code(r.path("code")); if (c.isEmpty() && r.path("id").asText().startsWith("ESI")) c=r.path("id").asText();
            ObjectNode item=out.addObject(); item.put("esiCode",c);
            item.put("name",esi.path(c).asText(coding(r.path("code")).path("display").asText(r.path("code").path("text").asText())));
            for (String k:new String[]{"valueQuantity","valueString","valueCodeableConcept","valueInteger","valueBoolean"}) if(r.has(k)) item.set("value",r.get(k));
            field(item,"unit",r.path("valueQuantity").path("unit"));
            for (JsonNode comp:r.path("component")) {
                ObjectNode synthetic=((ObjectNode)comp).deepCopy(); synthetic.put("resourceType","Observation"); items(synthetic,out);
            }
        } else if ("QuestionnaireResponse".equals(type)) {
            for (JsonNode q:r.path("item")) {
                ObjectNode i=out.addObject(); String c=r.path("id").asText(); i.put("esiCode",c);
                i.put("name",esi.path(c).asText(q.path("text").asText())); i.set("value",q.path("answer"));
            }
        }
    }
    public ArrayNode normalizeTree(JsonNode root) {
        List<JsonNode> all=new ArrayList<>(); Map<String,JsonNode> index=new HashMap<>(); collect(root,all,index);
        ArrayNode out=Json.M.createArrayNode();
        for(JsonNode r:all) {
            String type=r.path("resourceType").asText();
            if(!Arrays.asList("DiagnosticReport","ExplanationOfBenefit","MedicationDispense","Condition","Procedure").contains(type))continue;
            ObjectNode n=out.addObject(); n.put("contractVersion",1); n.put("id",type+"/"+r.path("id").asText());
            n.set("rawResource",r); // Traceability includes contained resources, not analysis.
            if(type.equals("DiagnosticReport")) {
                n.put("source","NHIS_PUBLIC"); n.put("datasetCode","2001"); n.put("kind","checkup");
                field(n,"date",r.path("effectiveDateTime")); n.put("checkupType",coding(r.path("code")).path("display").asText());
                n.set("institution",facility(r,r.path("performer").path(0),index));
                ArrayNode it=n.putArray("items"); for(JsonNode ref:r.path("result")) items(resolve(ref,r,index),it);
                field(n,"conclusion",r.path("conclusion"));
            } else if(type.equals("ExplanationOfBenefit")) {
                n.put("source","NHIS_PUBLIC"); n.put("datasetCode","2002"); n.put("kind","visit");
                field(n,"date",r.path("billablePeriod").path("start")); n.put("visitType",code(r.path("type")));
                n.set("institution",facility(r,r.path("provider"),index));
                // Public standard §4.1.4, pp25–27: category -> code.text; hospitalized is 방문입원일수, NOT proof of admission.
                for(JsonNode info:r.path("supportingInfo")) {
                    String c=code(info.path("category")); Double value=number(info.path("code").path("text"));
                    String key=c.equals("hospitalized")?"visitHospitalDays":c.equals("related")?"prescriptionCount":c.equals("other")?"treatmentDays":null;
                    if(key!=null && value!=null)n.put(key,value);
                }
                for(JsonNode total:r.path("total")) {
                    String c=code(total.path("category")); if(c.equals("copay")||c.equals("benefit"))field(n,c.equals("copay")?"copay":"benefit",total.path("amount"));
                }
            } else if(type.equals("MedicationDispense")) {
                n.put("source","HIRA_PUBLIC"); n.put("datasetCode","2004"); n.put("kind","dispense");
                JsonNode med=resolve(r.path("medicationReference"),r,index), drug=coding(med.path("code"));
                field(n,"drugCodeRaw",drug.path("code")); field(n,"drugCodeSystem",drug.path("system")); field(n,"productName",drug.path("display"));
                ArrayNode ingredients=n.putArray("ingredients");
                for(JsonNode ing:med.path("ingredient")) {
                    JsonNode substance=resolve(ing.path("itemReference"),r,index);
                    // Substance is often contained in the dispense, alongside Medication.
                    if(substance.isEmpty())substance=resolve(ing.path("itemReference"),med,index);
                    for(JsonNode c:substance.path("code").path("coding"))ingredients.add(c);
                }
                field(n,"date",r.path("whenPrepared")); field(n,"daysSupply",r.path("daysSupply").path("value"));
                JsonNode dose=r.path("dosageInstruction").path(0);
                field(n,"dosesPerDay",dose.path("timing").path("repeat").path("frequency"));
                field(n,"dosePerAdministration",dose.path("doseAndRate").path(0).path("doseQuantity").path("value"));
                JsonNode orgRef=r.path("performer").path(0).path("actor");
                n.set("institution",facility(r,orgRef,index));
            } else {
                n.put("source","MEDICAL_INSTITUTION"); n.put("datasetCode",type.equals("Condition")?"1004":"1010");
                n.put("kind",type.equals("Condition")?"condition":"procedure");
                JsonNode enc=resolve(r.path("encounter"),r,index);
                field(n,"date",type.equals("Condition")?r.path("recordedDate"):r.path("performedDateTime"));
                field(n,"encounterReference",r.path("encounter").path("reference"));
                field(n,"encounterPeriod",enc.path("period")); field(n,"encounterClass",enc.path("class"));
                field(n,"encounterIdentifiers",enc.path("identifier"));
                n.set("institution",facility(enc,enc.path("serviceProvider"),index));
                field(n,"status",r.path("status")); n.set("codings",r.path("code").path("coding"));
                for(JsonNode c:r.path("code").path("coding")) if(KCD.equals(c.path("system").asText())) {
                    field(n,"kcdCodeRaw",c.path("code")); field(n,"sourceDisplay",c.path("display")); n.put("kcdSystem",KCD);break;
                }
                // Keep referenced Encounter/Organization for auditing without confusing their IDs with cross-source keys.
                ObjectNode trace=n.putObject("rawContext"); if(!enc.isEmpty()) trace.set("encounter",enc);
                JsonNode org=resolve(enc.path("serviceProvider"),enc,index);if(!org.isEmpty())trace.set("organization",org);
            }
        }
        return out;
    }
}
