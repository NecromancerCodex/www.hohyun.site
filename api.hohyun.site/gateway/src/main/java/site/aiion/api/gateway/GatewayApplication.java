package site.aiion.api.gateway;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

// Spring Cloud Gateway 제거로 @EnableDiscoveryClient 불필요
@SpringBootApplication
@ComponentScan(basePackages = {
	"site.aiion.api.gateway",
	"site.aiion.api.oauth",
	"site.aiion.api.user",
	"site.aiion.api.diary"
})
@EntityScan(basePackages = {
	"site.aiion.api.diary",
	"site.aiion.api.diary.emotion",
	"site.aiion.api.diary.mbti",
	"site.aiion.api.user"
})
@EnableJpaRepositories(basePackages = {
	"site.aiion.api.user",
	"site.aiion.api.diary"  // 하위 패키지(diary.emotion, diary.mbti) 자동 포함
})
public class GatewayApplication {

	public static void main(String[] args) {
		SpringApplication.run(GatewayApplication.class, args);
	}

}

