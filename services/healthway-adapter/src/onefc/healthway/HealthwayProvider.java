package onefc.healthway;
import com.fasterxml.jackson.databind.JsonNode;
public interface HealthwayProvider {
    String name();
    JsonNode call(String sdkId, JsonNode request) throws Exception;
}
