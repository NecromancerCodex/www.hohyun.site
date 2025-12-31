package site.aiion.api.services.oauth.google;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.view.RedirectView;

/**
 * Google OAuth2 표준 콜백 경로 처리
 * Google Cloud Console에 등록된 redirect URI: /oauth2/google/callback
 * 실제 처리는 GoogleController의 googleCallback 메서드를 재사용
 */
@RestController
@RequestMapping("/oauth2")
public class GoogleOAuth2CallbackController {
    
    private final GoogleController googleController;
    
    public GoogleOAuth2CallbackController(GoogleController googleController) {
        this.googleController = googleController;
    }
    
    /**
     * Google OAuth2 표준 콜백 경로
     * /oauth2/google/callback -> GoogleController.googleCallback()로 위임
     */
    @GetMapping("/google/callback")
    public RedirectView googleCallback(
            @RequestParam(required = false) String code,
            @RequestParam(required = false) String state,
            @RequestParam(required = false) String error,
            @RequestParam(required = false) String error_description) {
        // GoogleController의 googleCallback 메서드 호출
        // 하지만 private이므로 직접 호출 불가능
        // 대신 GoogleController를 통해 처리하도록 리다이렉트
        // 또는 GoogleController의 메서드를 public으로 변경하고 직접 호출
        
        // 임시 해결책: GoogleController의 googleCallback 메서드를 public으로 변경 필요
        // 또는 GoogleController에 직접 접근할 수 있는 방법 필요
        
        // 가장 간단한 방법: GoogleController의 googleCallback 로직을 별도 서비스로 분리
        // 하지만 빠른 해결을 위해 GoogleController의 googleCallback을 직접 호출
        return googleController.googleCallback(code, state, error, error_description);
    }
}

