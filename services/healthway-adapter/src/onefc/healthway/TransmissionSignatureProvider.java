package onefc.healthway;
import com.fasterxml.jackson.databind.JsonNode;
/** PG-SDK-0199: external electronic signature, never ONE FC's image signature. */
public interface TransmissionSignatureProvider {
    JsonNode sign(JsonNode consent) throws Exception;
}
