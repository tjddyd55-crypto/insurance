package onefc.healthway;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.security.MessageDigest;
import java.nio.charset.StandardCharsets;
import java.util.*;
/** HMAC v1: METHOD\nPATH\nUNIX_SECONDS\nNONCE\nSHA256(body), lowercase hex. */
public final class HmacAuth {
    private final String secret;
    private final Map<String,Long> nonces=new HashMap<>();
    public HmacAuth(String secret) { if(secret==null || secret.length()<32)throw new IllegalArgumentException("Shared secret must have at least 32 characters");this.secret=secret; }
    public static String hex(byte[] data) { StringBuilder out=new StringBuilder();for(byte b:data)out.append(String.format("%02x",b&255));return out.toString(); }
    public static String sign(String secret,String method,String path,String timestamp,String nonce,byte[] body) throws Exception {
        String hash=hex(MessageDigest.getInstance("SHA-256").digest(body));
        String text=method+"\n"+path+"\n"+timestamp+"\n"+nonce+"\n"+hash;
        Mac mac=Mac.getInstance("HmacSHA256"); mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8),"HmacSHA256"));
        return hex(mac.doFinal(text.getBytes(StandardCharsets.UTF_8)));
    }
    public synchronized boolean verify(String method,String path,String timestamp,String nonce,String signature,byte[] body,long now) {
        try {
            if(timestamp==null || !timestamp.matches("[0-9]{1,12}") || Math.abs(now-Long.parseLong(timestamp))>300)return false;
            if(nonce==null || !nonce.matches("[a-zA-Z0-9_-]{16,128}") || signature==null || !signature.matches("[0-9a-f]{64}"))return false;
            nonces.entrySet().removeIf(e->e.getValue()<now);
            if(nonces.containsKey(nonce) || nonces.size()>=100000)return false;
            String expected=sign(secret,method,path,timestamp,nonce,body);
            if(!MessageDigest.isEqual(expected.getBytes(StandardCharsets.US_ASCII),signature.getBytes(StandardCharsets.US_ASCII)))return false;
            nonces.put(nonce,now+601);return true;
        }catch(Exception ex){return false;}
    }
}
