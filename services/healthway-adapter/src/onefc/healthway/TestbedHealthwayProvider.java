package onefc.healthway;
import java.util.Map;
public final class TestbedHealthwayProvider extends ConfiguredHealthwayProvider {
    public TestbedHealthwayProvider(Map<String,String> config) { super(config); }
    public String name() { return "testbed"; }
}
