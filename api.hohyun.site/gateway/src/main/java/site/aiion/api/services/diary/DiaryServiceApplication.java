package site.aiion.api.services.diary;

import org.springframework.boot.CommandLineRunner;
// Spring Cloud 제거로 import 불필요
// import org.springframework.boot.SpringApplication;
// import org.springframework.boot.autoconfigure.SpringBootApplication;
// import org.springframework.boot.autoconfigure.domain.EntityScan;
// import org.springframework.cloud.client.discovery.EnableDiscoveryClient;
import org.springframework.context.annotation.Bean;
// import org.springframework.context.annotation.ComponentScan;
import org.springframework.jdbc.core.JdbcTemplate;

// GatewayApplication에서 통합 실행되므로 별도 실행 불필요
// @EnableDiscoveryClient
// @SpringBootApplication
// @ComponentScan(basePackages = "site.aiion.api.services.diary")
// @EntityScan(basePackages = {"site.aiion.api.services.diary", "site.aiion.api.services.diary.emotion"})
public class DiaryServiceApplication 
{

	// GatewayApplication에서 통합 실행되므로 main 메서드 제거
	// public static void main(String[] args) {
	// 	SpringApplication.run(DiaryServiceApplication.class, args);
	// 	System.out.println("[DiaryServiceApplication] EntityScan packages: site.aiion.api.services.diary, site.aiion.api.services.diary.emotion");
	// }

	// CommandLineRunner는 GatewayApplication에서 @Bean으로 등록 필요
	@Bean
	public CommandLineRunner initSequence(JdbcTemplate jdbcTemplate) {
		return args -> {
			try {
				// diaries 시퀀스 재설정
				String maxIdQuery = "SELECT COALESCE(MAX(id), 0) FROM diaries";
				Integer maxId = jdbcTemplate.queryForObject(maxIdQuery, Integer.class);
				if (maxId != null && maxId > 0) {
					String resetSequence = String.format("SELECT setval('diaries_id_seq', %d, true)", maxId);
					jdbcTemplate.execute(resetSequence);
					System.out.println("[DiaryServiceApplication] diaries 시퀀스 재설정 완료: " + maxId);
				}
			} catch (Exception e) {
				System.err.println("[DiaryServiceApplication] 시퀀스 재설정 실패: " + e.getMessage());
			}
		};
	}

}

