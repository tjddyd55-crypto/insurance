package onefc.healthway;
import com.fasterxml.jackson.databind.JsonNode;
import java.nio.file.*;
import java.util.Map;
/** Config boundary only. Real calls remain disabled until approved testbed integration is verified. */
abstract class ConfiguredHealthwayProvider implements HealthwayProvider {
    final Map<String,String> config;
    ConfiguredHealthwayProvider(Map<String,String> config) { this.config = config; }
    public JsonNode call(String id, JsonNode request) {
        String path = config.get("HEALTHWAY_MYMD_PROPERTIES");
        boolean configured = path != null && Files.isRegularFile(Paths.get(path));
        throw new IllegalStateException(name() + " not configured / not enabled: approved properties, tester ID, datasets, encryption key pair, callback and signature provider require verification" + (configured ? " (properties mounted)" : ""));
    }
}
