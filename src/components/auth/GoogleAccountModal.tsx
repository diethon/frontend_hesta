import React, { useEffect, useRef, useCallback } from 'react';

const GOOGLE_CLIENT_ID = '962352236636-panbra9em73iofocv7r96hj200i40igl.apps.googleusercontent.com';

// Augment window with Google Identity Services types
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
          }) => void;
          prompt: (notification?: (notification: {
            isNotDisplayed: () => boolean;
            isSkippedMoment: () => boolean;
            getNotDisplayedReason: () => string;
            getSkippedReason: () => string;
          }) => void) => void;
          renderButton: (
            element: HTMLElement,
            config: {
              type?: 'standard' | 'icon';
              theme?: 'outline' | 'filled_blue' | 'filled_black';
              size?: 'large' | 'medium' | 'small';
              text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
              shape?: 'rectangular' | 'pill' | 'circle' | 'square';
              logo_alignment?: 'left' | 'center';
              width?: number;
              locale?: string;
            }
          ) => void;
          cancel: () => void;
          revoke: (email: string, callback: () => void) => void;
        };
      };
    };
  }
}

interface GoogleSignInButtonProps {
  onSuccess: (idToken: string) => void;
  onError: (error: string) => void;
  disabled?: boolean;
}

export const GoogleSignInButton: React.FC<GoogleSignInButtonProps> = ({
  onSuccess,
  onError,
  disabled = false,
}) => {
  const buttonRef = useRef<HTMLDivElement>(null);
  const isInitialized = useRef(false);

  const handleCredentialResponse = useCallback(
    (response: { credential: string }) => {
      if (response.credential) {
        onSuccess(response.credential);
      } else {
        onError('Không nhận được thông tin xác thực từ Google.');
      }
    },
    [onSuccess, onError]
  );

  useEffect(() => {
    if (isInitialized.current) return;

    const initGoogleSignIn = () => {
      if (!window.google?.accounts?.id) {
        // SDK chưa tải xong, thử lại sau 200ms
        setTimeout(initGoogleSignIn, 200);
        return;
      }

      try {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleCredentialResponse,
          auto_select: false,
          cancel_on_tap_outside: true,
        });

        // Render nút đăng nhập chính thức từ Google
        if (buttonRef.current) {
          window.google.accounts.id.renderButton(buttonRef.current, {
            type: 'standard',
            theme: 'outline',
            size: 'large',
            text: 'signin_with',
            shape: 'pill',
            logo_alignment: 'left',
            width: 280,
          });
        }

        isInitialized.current = true;
      } catch (err) {
        console.error('Failed to initialize Google Sign-In:', err);
        onError('Không thể khởi tạo Google Sign-In. Vui lòng tải lại trang.');
      }
    };

    initGoogleSignIn();
  }, [handleCredentialResponse, onError]);

  return (
    <div className="w-full">
      {/* Container cho nút Google chính thức */}
      <div
        ref={buttonRef}
        className={`flex min-w-0 justify-center overflow-hidden transition-opacity ${
          disabled ? 'opacity-50 pointer-events-none' : 'opacity-100'
        }`}
      />

      {/* Fallback nếu SDK chưa load */}
      {!window.google?.accounts?.id && (
        <div className="flex items-center justify-center gap-2 py-3 text-slate-400 text-xs">
          <svg aria-hidden={true} className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span>Đang tải Google Sign-In…</span>
        </div>
      )}
    </div>
  );
};
