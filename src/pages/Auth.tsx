import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Check, X } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import logo from "@/assets/landing/unvrs-logo.png";
import { MorseLED } from "@/components/MorseLED";

export default function Auth() {
  const navigate = useNavigate();
  const { isOwner } = useUserRole();
  const [step, setStep] = useState<"phone" | "otp" | "username">("phone");
  const [countryCode, setCountryCode] = useState("+34");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otp, setOtp] = useState("");
  const [username, setUsername] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);

  // Check if user is already logged in
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        // Check user role and redirect accordingly
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', session.user.id)
          .single();
        
        if (roleData?.role === 'owner') {
          navigate("/admin/dashboard");
        } else {
          navigate("/marketplace");
        }
      }
    };
    checkSession();
  }, [navigate]);

  // Auto-verify OTP when 6 digits are entered
  useEffect(() => {
    if (otp.length === 6 && step === "otp" && !loading) {
      handleVerifyOtp();
    }
  }, [otp]);

  // Auto-send OTP when phone number is complete
  useEffect(() => {
    if (step === "phone" && !loading && phoneNumber.length > 0) {
      const requiredLength = countryCode === "+34" ? 9 : countryCode === "+39" ? 10 : 10;
      if (phoneNumber.length === requiredLength) {
        handleSendOtp();
      }
    }
  }, [phoneNumber, countryCode]);

  // Check username availability in real-time
  useEffect(() => {
    if (step === "username" && username.length >= 3) {
      const checkUsername = async () => {
        setCheckingUsername(true);
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('username')
            .eq('username', username.toLowerCase())
            .maybeSingle();

          if (error) {
            console.error('Error checking username:', error);
            setUsernameAvailable(null);
            return;
          }

          setUsernameAvailable(!data);
        } catch (error) {
          console.error('Error checking username:', error);
          setUsernameAvailable(null);
        } finally {
          setCheckingUsername(false);
        }
      };

      const timer = setTimeout(checkUsername, 500);
      return () => clearTimeout(timer);
    } else {
      setUsernameAvailable(null);
    }
  }, [username, step]);

  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    if (!phoneNumber) {
      toast.error("Please enter phone number");
      return;
    }

    const fullPhoneNumber = `${countryCode}${phoneNumber}`;
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("send-otp", {
        body: { phoneNumber: fullPhoneNumber },
      });

      if (error) throw error;

      if (data.success) {
        toast.success("OTP code sent on Telegram!");
        setStep("otp");
      } else {
        throw new Error(data.error || "Error sending OTP");
      }
    } catch (error) {
      console.error("Error sending OTP:", error);
      toast.error("Error sending OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!otp || otp.length !== 6) {
      toast.error("Please enter a valid OTP code (6 digits)");
      return;
    }

    const fullPhoneNumber = `${countryCode}${phoneNumber}`;
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("verify-otp", {
        body: { 
          phoneNumber: fullPhoneNumber, 
          code: otp,
        },
      });

      if (error) throw error;

      if (data.success && data.session) {
        // Set the session from the edge function response
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });

        if (sessionError) {
          console.error("Session error:", sessionError);
          throw new Error("Failed to set session");
        }

        // Get the authenticated user
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          setUserId(user.id);
          
          // Check if user has username
          const { data: profile } = await supabase
            .from('profiles')
            .select('username')
            .eq('user_id', user.id)
            .maybeSingle();

          if (profile?.username) {
            // User already has username, go to dashboard
            toast.success("Login successful!");
            
            // Check user role and redirect accordingly
            const { data: roleData } = await supabase
              .from('user_roles')
              .select('role')
              .eq('user_id', user.id)
              .single();
            
            if (roleData?.role === 'owner') {
              navigate("/admin/dashboard");
            } else {
              navigate("/marketplace");
            }
          } else {
            // New user or user without username, go to username step
            setStep("username");
            if (data.isNewUser) {
              toast.success("Account created! Please choose your username.");
            } else {
              toast.success("Please set your username.");
            }
          }
        }
      } else {
        throw new Error(data.error || "Invalid OTP code");
      }
    } catch (error) {
      console.error("Error verifying OTP:", error);
      toast.error("Invalid or expired OTP code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (step === "username") {
      setStep("phone");
      setPhoneNumber("");
      setOtp("");
      setUsername("");
    } else {
      setStep("phone");
      setOtp("");
    }
  };

  const handleSubmitUsername = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!username || username.length < 3) {
      toast.error("Username must be at least 3 characters");
      return;
    }

    if (usernameAvailable === false) {
      toast.error("Username already taken");
      return;
    }

    if (!userId) {
      toast.error("User not authenticated");
      return;
    }

    setLoading(true);

    try {
      // Update profile with username
      const { error } = await supabase
        .from('profiles')
        .update({ username: username.toLowerCase() })
        .eq('user_id', userId);

      if (error) {
        if (error.code === '23505') {
          toast.error("Username already taken. Please choose another.");
        } else {
          throw error;
        }
        return;
      }

      toast.success("Username set successfully!");
      
      // Check user role and redirect accordingly
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .single();
      
      if (roleData?.role === 'owner') {
        navigate("/admin/dashboard");
      } else {
        navigate("/marketplace");
      }
    } catch (error) {
      console.error("Error setting username:", error);
      toast.error("Error setting username. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black p-4 relative overflow-hidden">

      <header className="fixed top-6 left-6 z-50 flex items-center gap-3">
        <Link to="/" className="flex items-center gap-3 group">
          <div className="w-12 h-12">
            <img src={logo} alt="Unvrs Labs" className="w-full h-full object-contain" />
          </div>
          <span 
            className="text-xl font-semibold tracking-tight text-white transition-opacity group-hover:opacity-80"
            style={{ fontFamily: "Orbitron, sans-serif" }}
          >
            UNVRS LABS
          </span>
        </Link>
      </header>

      {/* Liquid Glass Card */}
      <div 
        className="w-full max-w-md relative rounded-3xl p-8"
        style={{
          background: "linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          border: "1px solid rgba(255,255,255,0.15)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 0 rgba(255,255,255,0.15)",
        }}
      >
        {/* LED Indicator */}
        <div className="flex justify-center mb-6">
          <MorseLED />
        </div>

        {/* Header */}
        <div className="text-center mb-8">
          <h1 
            className="text-2xl font-bold text-white mb-2"
            style={{ fontFamily: "Orbitron, sans-serif" }}
          >
            {step === "username" ? "Choose Username" : "Login with Telegram"}
          </h1>
          <p 
            className="text-white/60 text-sm"
            style={{ fontFamily: "Orbitron, sans-serif" }}
          >
            {step === "phone" 
              ? <>Enter your phone number to receive<br />the OTP code via Telegram</>
              : step === "otp"
              ? "Enter the code you received on Telegram"
              : "Choose a unique username for your account"
            }
          </p>
        </div>

        {/* Content */}
        <div>
          {step === "phone" ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-white/80" style={{ fontFamily: "Orbitron, sans-serif" }}>
                  Phone number
                </Label>
                <div className="flex gap-2">
                  <Select value={countryCode} onValueChange={setCountryCode}>
                    <SelectTrigger 
                      className="w-[120px] bg-white/5 border-white/20 text-white hover:bg-white/10"
                      style={{ fontFamily: "Orbitron, sans-serif" }}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-black/90 backdrop-blur-xl border-white/20">
                      <SelectItem value="+34" className="text-white hover:bg-white/10">🇪🇸 +34</SelectItem>
                      <SelectItem value="+39" className="text-white hover:bg-white/10">🇮🇹 +39</SelectItem>
                      <SelectItem value="+44" className="text-white hover:bg-white/10">🇬🇧 +44</SelectItem>
                      <SelectItem value="+1" className="text-white hover:bg-white/10">🇺🇸 +1</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder={countryCode === "+34" ? "612345678" : "3331234567"}
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ""))}
                    required
                    disabled={loading}
                    className="flex-1 bg-white/5 border-white/20 text-white placeholder:text-white/40 focus:border-lime-500/50 focus:ring-lime-500/20"
                    style={{ fontFamily: "Orbitron, sans-serif" }}
                    maxLength={countryCode === "+34" ? 9 : 10}
                    autoFocus
                  />
                </div>
                {loading && (
                  <div className="flex items-center gap-2 text-xs text-white/60">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span style={{ fontFamily: "Orbitron, sans-serif" }}>Sending code...</span>
                  </div>
                )}
              </div>
            </div>
          ) : step === "otp" ? (
            <div className="space-y-6">
              <div className="text-center space-y-4">
                <p 
                  className="text-sm text-white/60"
                  style={{ fontFamily: "Orbitron, sans-serif" }}
                >
                  Code sent to {countryCode}{phoneNumber}
                </p>
                <Button
                  type="button"
                  variant="link"
                  onClick={handleBack}
                  disabled={loading}
                  className="text-sm text-lime-400 hover:text-lime-300 underline"
                  style={{ fontFamily: "Orbitron, sans-serif" }}
                >
                  Change number
                </Button>
              </div>
              
              <div className="flex justify-center">
                <InputOTP
                  maxLength={6}
                  value={otp}
                  onChange={setOtp}
                  disabled={loading}
                >
                  <InputOTPGroup className="gap-2">
                    {[0, 1, 2, 3, 4, 5].map((index) => (
                      <InputOTPSlot 
                        key={index}
                        index={index} 
                        className="bg-white/5 border-white/20 text-white w-12 h-14 text-xl rounded-xl"
                        style={{ fontFamily: "Orbitron, sans-serif" }}
                      />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
              </div>

              {loading && (
                <div className="flex items-center justify-center gap-2 text-sm text-white/60">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span style={{ fontFamily: "Orbitron, sans-serif" }}>Verifying...</span>
                </div>
              )}

              <div className="text-center space-y-2">
                <p 
                  className="text-sm text-white/50"
                  style={{ fontFamily: "Orbitron, sans-serif" }}
                >
                  Didn&apos;t receive the code?
                </p>
                <Button
                  type="button"
                  variant="link"
                  onClick={handleSendOtp}
                  disabled={loading}
                  className="text-sm text-lime-400 hover:text-lime-300"
                  style={{ fontFamily: "Orbitron, sans-serif" }}
                >
                  Resend Code
                </Button>
              </div>
            </div>
          ) : step === "username" ? (
            <form onSubmit={handleSubmitUsername} className="space-y-6">
              <div className="space-y-2">
                <Label 
                  htmlFor="username" 
                  className="text-white/80"
                  style={{ fontFamily: "Orbitron, sans-serif" }}
                >
                  Username
                </Label>
                <div className="relative">
                  <Input
                    id="username"
                    type="text"
                    placeholder="johndoe"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ""))}
                    required
                    disabled={loading}
                    minLength={3}
                    maxLength={20}
                    autoFocus
                    className="pr-10 bg-white/5 border-white/20 text-white placeholder:text-white/40 focus:border-lime-500/50 focus:ring-lime-500/20"
                    style={{ fontFamily: "Orbitron, sans-serif" }}
                  />
                  {username.length >= 3 && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {checkingUsername ? (
                        <Loader2 className="h-4 w-4 animate-spin text-white/60" />
                      ) : usernameAvailable === true ? (
                        <Check className="h-4 w-4 text-lime-400" />
                      ) : usernameAvailable === false ? (
                        <X className="h-4 w-4 text-red-400" />
                      ) : null}
                    </div>
                  )}
                </div>
                <p 
                  className="text-xs text-white/50"
                  style={{ fontFamily: "Orbitron, sans-serif" }}
                >
                  {username.length >= 3 && usernameAvailable === false
                    ? "Username already taken"
                    : "3-20 characters, lowercase, no spaces"}
                </p>
              </div>
              <Button 
                type="submit" 
                className="w-full rounded-xl py-6 text-sm font-medium transition-all"
                style={{
                  fontFamily: "Orbitron, sans-serif",
                  background: "linear-gradient(135deg, rgba(132, 204, 22, 0.4), rgba(34, 197, 94, 0.4))",
                  border: "1px solid rgba(132, 204, 22, 0.5)",
                }}
                disabled={loading || checkingUsername || usernameAvailable === false}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Setting username...
                  </>
                ) : (
                  "Continue"
                )}
              </Button>
            </form>
          ) : null}
        </div>
      </div>
    </div>
  );
}
