import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowUpRight, Check, LockKeyhole, ShieldCheck, Zap } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { getGetCurrentUserQueryKey, useLogin, useRegister, type AuthUser } from "@workspace/api-client-react";
import { BrandLogo } from "@/components/BrandLogo";
import { Form } from "@/components/ui/form";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
});

const registerSchema = z.object({
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(32, "Username is too long")
    .regex(/^[a-zA-Z0-9_]+$/, "Use only letters, numbers, and underscores"),
  email: z.string().email("Enter a valid email address"),
  password: z
    .string()
    .min(10, "Use at least 10 characters")
    .max(128, "Password is too long"),
});

type LoginValues = z.infer<typeof loginSchema>;
type RegisterValues = z.infer<typeof registerSchema>;

export function AuthPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const login = useLogin();
  const register = useRegister();
  const loginForm = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });
  const registerForm = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { username: "", email: "", password: "" },
  });

  function finishAuth(response: { user: AuthUser }) {
    queryClient.setQueryData(getGetCurrentUserQueryKey(), response.user);
    setLocation("/dashboard");
  }

  const mutationError =
    mode === "login" ? login.error?.message : register.error?.message;

  return (
    <main className="auth-page" data-testid="page-auth">
      <div className="auth-ambient auth-ambient-one" />
      <div className="auth-ambient auth-ambient-two" />
      <header className="auth-topbar">
        <BrandLogo />
        <div className="auth-top-note">
          <span className="online-dot" />
          REWARDS NETWORK ONLINE
        </div>
      </header>

      <div className="auth-content">
        <section className="auth-story">
          <div className="eyebrow"><Zap size={14} /> THE NEXT LEVEL OF REWARDS</div>
          <h1>
            Make every
            <br />
            <span>click count.</span>
          </h1>
          <p className="auth-story-copy">
            Turn the time you already spend online into real rewards. Complete
            offers, stack ZX Coins, and cash out on your terms.
          </p>

          <div className="auth-perks">
            <div className="auth-perk">
              <span className="perk-icon"><Zap size={16} /></span>
              <div><strong>Five trusted offerwalls</strong><small>More ways to earn every day</small></div>
              <Check size={16} className="perk-check" />
            </div>
            <div className="auth-perk">
              <span className="perk-icon purple"><ShieldCheck size={16} /></span>
              <div><strong>Secure by design</strong><small>Your rewards stay in your account</small></div>
              <Check size={16} className="perk-check" />
            </div>
          </div>

          <div className="auth-community">
            <div className="avatar-stack" aria-hidden="true">
              <span>A</span><span>M</span><span>J</span><span>+</span>
            </div>
            <p><strong>Built for earners.</strong><br /><span>Join the ZEROX community.</span></p>
          </div>
        </section>

        <section className="auth-card-wrap">
          <div className="auth-card">
            <div className="auth-card-heading">
              <span className="auth-card-kicker">{mode === "login" ? "MEMBER ACCESS" : "CREATE YOUR ACCOUNT"}</span>
              <h2>{mode === "login" ? "Welcome back" : "Start earning"}</h2>
              <p>{mode === "login" ? "Sign in to pick up where you left off." : "Create your free account in seconds."}</p>
            </div>

            <div className="auth-mode-switch" role="tablist" aria-label="Account access">
              <button
                type="button"
                role="tab"
                aria-selected={mode === "login"}
                className={mode === "login" ? "active" : ""}
                onClick={() => { setMode("login"); login.reset(); register.reset(); }}
                data-testid="tab-login"
              >
                Sign in
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === "register"}
                className={mode === "register" ? "active" : ""}
                onClick={() => { setMode("register"); login.reset(); register.reset(); }}
                data-testid="tab-register"
              >
                Create account
              </button>
            </div>

            {mode === "login" ? (
              <Form {...loginForm}>
                <form
                  className="auth-form"
                  onSubmit={loginForm.handleSubmit((values) =>
                    login.mutate({ data: values }, { onSuccess: finishAuth }),
                  )}
                  noValidate
                >
                  <label className="field-label" htmlFor="login-email">Email address</label>
                  <input
                    id="login-email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    {...loginForm.register("email")}
                    data-testid="input-login-email"
                  />
                  {loginForm.formState.errors.email && <span className="field-error">{loginForm.formState.errors.email.message}</span>}

                  <div className="field-label-row">
                    <label className="field-label" htmlFor="login-password">Password</label>
                    <span className="field-hint"><LockKeyhole size={12} /> SECURE SESSION</span>
                  </div>
                  <input
                    id="login-password"
                    type="password"
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    {...loginForm.register("password")}
                    data-testid="input-login-password"
                  />
                  {loginForm.formState.errors.password && <span className="field-error">{loginForm.formState.errors.password.message}</span>}
                  {mutationError && <p className="form-error" role="alert" data-testid="status-auth-error">{mutationError}</p>}

                  <button
                    className="primary-button auth-submit"
                    type="submit"
                    disabled={login.isPending}
                    data-testid="button-login"
                  >
                    {login.isPending ? "Signing in..." : "Sign in to ZEROX"}
                    {!login.isPending && <ArrowUpRight size={17} />}
                  </button>
                </form>
              </Form>
            ) : (
              <Form {...registerForm}>
                <form
                  className="auth-form"
                  onSubmit={registerForm.handleSubmit((values) =>
                    register.mutate({ data: values }, { onSuccess: finishAuth }),
                  )}
                  noValidate
                >
                  <label className="field-label" htmlFor="register-username">Username</label>
                  <input
                    id="register-username"
                    autoComplete="username"
                    placeholder="Choose a username"
                    {...registerForm.register("username")}
                    data-testid="input-register-username"
                  />
                  {registerForm.formState.errors.username && <span className="field-error">{registerForm.formState.errors.username.message}</span>}

                  <label className="field-label" htmlFor="register-email">Email address</label>
                  <input
                    id="register-email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    {...registerForm.register("email")}
                    data-testid="input-register-email"
                  />
                  {registerForm.formState.errors.email && <span className="field-error">{registerForm.formState.errors.email.message}</span>}

                  <label className="field-label" htmlFor="register-password">Password</label>
                  <input
                    id="register-password"
                    type="password"
                    autoComplete="new-password"
                    placeholder="At least 10 characters"
                    {...registerForm.register("password")}
                    data-testid="input-register-password"
                  />
                  {registerForm.formState.errors.password && <span className="field-error">{registerForm.formState.errors.password.message}</span>}
                  {mutationError && <p className="form-error" role="alert" data-testid="status-auth-error">{mutationError}</p>}

                  <button
                    className="primary-button auth-submit"
                    type="submit"
                    disabled={register.isPending}
                    data-testid="button-register"
                  >
                    {register.isPending ? "Creating account..." : "Create free account"}
                    {!register.isPending && <ArrowUpRight size={17} />}
                  </button>
                </form>
              </Form>
            )}

            <div className="auth-safe-note">
              <ShieldCheck size={15} />
              <span>Your account is protected with encrypted credentials.</span>
            </div>
          </div>
          <p className="auth-terms">By continuing, you agree to the ZEROX EARN account terms and privacy policy.</p>
        </section>
      </div>

      <footer className="auth-footer">
        <span>© {new Date().getFullYear()} ZEROX EARN</span>
        <span className="auth-footer-status"><span className="online-dot" /> SYSTEMS OPERATIONAL</span>
      </footer>
          <span className="sr-only" aria-live="polite">ZEROX EARN account access</span>
    </main>
  );
}
