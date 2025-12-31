package site.aiion.api.gateway.config;

import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;

@Configuration
public class RestTemplateConfig {
    
    @Bean
    public RestTemplate restTemplate(RestTemplateBuilder builder) {
        // Spring Boot 3.4.0 이후 setConnectTimeout/setReadTimeout이 deprecated되었으므로
        // ClientHttpRequestFactory를 직접 설정
        // 타임아웃 설정: 연결 10초, 읽기 120초 (CPU 환경에서 DL 모델 추론 시간 고려)
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout((int) Duration.ofSeconds(10).toMillis()); // 10초
        factory.setReadTimeout((int) Duration.ofSeconds(120).toMillis()); // 120초 (CPU로 4개 MBTI 차원 분석 시간 고려)
        
        return builder
            .requestFactory(() -> factory)
            .build();
    }
}

