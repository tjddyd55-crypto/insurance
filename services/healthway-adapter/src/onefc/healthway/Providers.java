package onefc.healthway;
import java.util.Map;
public final class Providers {
    public static HealthwayProvider select(Map<String,String> env) throws Exception {
        String name = env.getOrDefault("HEALTHWAY_PROVIDER", "offline");
        switch (name) {
        case "offline": return new OfflineHealthwayProvider(env);
        case "testbed": return new TestbedHealthwayProvider(env);
        case "production":
            if (!"true".equals(env.get("HEALTHWAY_ALLOW_PRODUCTION")))
                throw new IllegalStateException("production not configured: explicit allow flag required");
            return new ProductionHealthwayProvider(env);
        default: throw new IllegalArgumentException("Unsupported provider");
        }
    }
}
