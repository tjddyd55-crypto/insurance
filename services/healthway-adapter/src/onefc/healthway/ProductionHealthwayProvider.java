package onefc.healthway;
import java.util.Map;
public final class ProductionHealthwayProvider extends ConfiguredHealthwayProvider {
    public ProductionHealthwayProvider(Map<String,String> config) { super(config); }
    public String name() { return "production"; }
}
