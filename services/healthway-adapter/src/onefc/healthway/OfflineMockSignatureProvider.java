package onefc.healthway;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.UUID;
public final class OfflineMockSignatureProvider implements TransmissionSignatureProvider {
    public JsonNode sign(JsonNode consent) {
        ObjectNode out = Json.M.createObjectNode();
        out.put("mock", true); out.put("label", "MOCK — 오프라인 전자서명 테스트");
        for (String key : new String[]{"caCode","signClientId","contentId","signedContent","txId","siteTxId"})
            out.put(key, "MOCK-" + UUID.randomUUID());
        return out;
    }
}
