package onefc.healthway;
import com.sun.net.httpserver.*;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.net.*;
import java.io.*;
import java.util.*;
import java.util.concurrent.*;

public final class Main {
    public static void main(String[] args) throws Exception {
        Map<String,String> env=System.getenv();
        String secret=env.get("HEALTHWAY_ADAPTER_SHARED_SECRET");
        boolean localTest="true".equals(env.get("HEALTHWAY_LOCAL_TEST_MODE"));
        if(secret==null && localTest && "offline".equals(env.getOrDefault("HEALTHWAY_PROVIDER","offline")))secret="LOCAL-TEST-"+UUID.randomUUID();
        HmacAuth auth=new HmacAuth(secret); // Fail before loading SDK.
        // SDK prints URLs and exceptions itself. Drop SDK stdout/stderr; HTTP exposes only sanitized errors.
        System.setOut(new PrintStream(OutputStream.nullOutputStream()));
        System.setErr(new PrintStream(OutputStream.nullOutputStream()));
        HealthwayProvider provider=Providers.select(env);
        HttpServer server=HttpServer.create(new InetSocketAddress(InetAddress.getByName("::"),Integer.parseInt(env.getOrDefault("PORT","8080"))),64);
        server.createContext("/",e->handle(e,auth,provider));
        server.setExecutor(new ThreadPoolExecutor(2,8,30,TimeUnit.SECONDS,new ArrayBlockingQueue<Runnable>(128),new ThreadPoolExecutor.AbortPolicy()));
        Runtime.getRuntime().addShutdownHook(new Thread(()->server.stop(1)));
        server.start();
    }
    private static void reply(HttpExchange e,int status,JsonNode data) throws IOException {
        byte[] bytes=Json.M.writeValueAsBytes(data);e.getResponseHeaders().set("Content-Type","application/json; charset=utf-8");
        e.getResponseHeaders().set("Cache-Control","no-store");e.sendResponseHeaders(status,bytes.length);
        try(OutputStream out=e.getResponseBody()){out.write(bytes);} e.close();
    }
    static void handle(HttpExchange e,HmacAuth auth,HealthwayProvider provider) throws IOException {
        String path=e.getRequestURI().getRawPath();
        if(path.equals("/healthz") && e.getRequestMethod().equals("GET")) {
            ObjectNode status=Json.M.createObjectNode(); status.put("ok",true);status.put("mode",provider.name());status.put("provider",provider.name());status.put("sdkVersion","0.2.8-SNAPSHOT");reply(e,200,status);return;
        }
        byte[] body=e.getRequestBody().readNBytes(1024*1024+1);
        if(body.length>1024*1024){reply(e,413,error("body_too_large"));return;}
        Headers h=e.getRequestHeaders();
        if(e.getRequestURI().getRawQuery()!=null || !auth.verify(e.getRequestMethod(),path,h.getFirst("X-Healthway-Timestamp"),h.getFirst("X-Healthway-Nonce"),h.getFirst("X-Healthway-Signature"),body,System.currentTimeMillis()/1000)) {
            reply(e,401,error("adapter_auth_failed"));return;
        }
        try {
            if(!e.getRequestMethod().equals("POST")){reply(e,405,error("method_not_allowed"));return;}
            JsonNode input=Json.M.readTree(body);
            if(path.equals("/signature") && provider.name().equals("offline")){reply(e,200,new OfflineMockSignatureProvider().sign(input));return;}
            if(!path.matches("/sdk/[0-9]{4}")){reply(e,404,error("unsupported_endpoint"));return;}
            reply(e,200,provider.call(path.substring(5),input));
        } catch(IllegalArgumentException ex) {reply(e,400,error("unsupported_or_invalid_sdk_arguments"));}
          catch(Exception ex) {reply(e,503,error(provider.name().equals("offline")?"offline_sdk_call_failed":"provider_not_configured"));}
    }
    private static ObjectNode error(String code){return Json.M.createObjectNode().put("error",code);}
}
