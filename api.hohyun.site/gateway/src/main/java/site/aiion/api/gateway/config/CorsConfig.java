package site.aiion.api.gateway.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.CorsFilter;

@Configuration
public class CorsConfig {

    @Bean
    public CorsFilter corsFilter() {
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        CorsConfiguration config = new CorsConfiguration();
        
        // 허용할 Origin
        config.addAllowedOrigin("http://localhost:3000");  // www.hohyun.site
        config.addAllowedOrigin("http://localhost:4000");  // admin.aiion.site
        config.addAllowedOrigin("http://localhost:5000");  // yolo.hohyun.site
        config.addAllowedOrigin("http://localhost:7000");  // lag.hohyun.site
        config.addAllowedOrigin("http://127.0.0.1:3000");
        config.addAllowedOrigin("http://127.0.0.1:4000");
        config.addAllowedOrigin("http://127.0.0.1:5000");
        config.addAllowedOrigin("http://127.0.0.1:7000");
        
        // 허용할 HTTP 메서드
        config.addAllowedMethod("GET");
        config.addAllowedMethod("POST");
        config.addAllowedMethod("PUT");
        config.addAllowedMethod("DELETE");
        config.addAllowedMethod("OPTIONS");
        config.addAllowedMethod("PATCH");
        
        // 허용할 헤더
        config.addAllowedHeader("*");
        
        // Credentials 허용
        config.setAllowCredentials(true);
        
        // 노출할 헤더
        config.addExposedHeader("Content-Type");
        config.addExposedHeader("Authorization");
        config.addExposedHeader("X-Total-Count");
        
        // Preflight 요청 캐시 시간
        config.setMaxAge(3600L);
        
        source.registerCorsConfiguration("/**", config);
        return new CorsFilter(source);
    }
}

