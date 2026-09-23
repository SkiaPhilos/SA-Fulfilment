import { useState } from 'react';
import { api, AuthResponse } from '../lib/api';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Notice } from './ui/Notice';
import {
  Mail,
  Lock,
  KeyRound,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  ArrowLeft,
  Building,
  User,
  Phone,
  MapPin,
  FileText
} from 'lucide-react';
import logisticsHubImg from '../assets/images/logistics_fulfillment_hub_1790131345824.jpg';

interface AuthScreenProps {
  onSuccess: (data: AuthResponse) => void;
}

export function AuthScreen({ onSuccess }: AuthScreenProps) {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot' | 'reset'>('login');

  // Login states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // Register states
  const [regName, setRegName] = useState('');
  const [regBusinessName, setRegBusinessName] = useState('');
  const [regBrandName, setRegBrandName] = useState('');
  const [regCnic, setRegCnic] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regAddress, setRegAddress] = useState('');
  const [regCity, setRegCity] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [devOtpHint, setDevOtpHint] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);

    try {
      const res = await api.login(email, password);
      onSuccess(res);
    } catch (err: any) {
      setError(err.message || 'Login failed. Please verify your email and password.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);

    try {
      const res = await api.registerCustomer({
        name: regName,
        business_name: regBusinessName,
        brand_name: regBrandName || regBusinessName,
        cnic_or_ntn: regCnic,
        phone: regPhone,
        address: regAddress,
        city: regCity,
        email: regEmail,
        password: regPassword
      });

      setNotice(res.message);
      setMode('login');
      setEmail(regEmail);
      setPassword('');
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please check your information.');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);

    try {
      const res = await api.requestPasswordReset(email);
      setNotice(res.message);
      if (res.devOtpHint) {
        setDevOtpHint(res.devOtpHint);
      }
      setMode('reset');
    } catch (err: any) {
      setError(err.message || 'Failed to request reset OTP.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);

    try {
      const res = await api.resetPassword(email, otp, newPassword);
      setNotice(res.message);
      setMode('login');
      setPassword('');
      setOtp('');
      setNewPassword('');
    } catch (err: any) {
      setError(err.message || 'Failed to update password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4 sm:p-6 lg:p-8">
      <div className={`w-full ${mode === 'register' ? 'max-w-5xl' : 'max-w-4xl'} bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[580px] transition-all duration-200`}>
        {/* Left Visual Editorial Column */}
        <div className="hidden lg:flex lg:col-span-5 relative flex-col justify-between p-8 bg-slate-900 text-white overflow-hidden">
          {/* Background Photography with Scrim */}
          <div className="absolute inset-0 z-0">
            <img
              src={logisticsHubImg}
              alt="Ship Asaan Logistics Operations Hub"
              className="w-full h-full object-cover opacity-35"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/80 to-slate-900/60" />
          </div>

          {/* Top Brand Lockup */}
          <div className="relative z-10">
            <div className="flex items-center gap-2.5 mb-6">
              <div className="w-8 h-8 rounded bg-emerald-600 flex items-center justify-center font-bold text-white text-sm tracking-wider shadow-sm">
                SA
              </div>
              <span className="text-lg font-bold tracking-tight text-white">Ship Asaan</span>
            </div>

            <h2 className="text-2xl font-bold tracking-tight text-white leading-snug">
              Precision Courier & Fulfillment Management
            </h2>
            <p className="text-xs text-slate-300 mt-2 leading-relaxed">
              Unified operational control for lightweight warehousing, physical scan-to-place putaway, and high-velocity order fulfillment.
            </p>
          </div>

          {/* Feature Highlights with Unboxed Typography */}
          <div className="relative z-10 space-y-3 pt-6 border-t border-slate-800/80 text-xs text-slate-300">
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-white">Physical Barcode Accuracy</span>
                <p className="text-[11px] text-slate-400 mt-0.5">Mandatory scanning ensures inventory matches real-world shelves.</p>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-white">Immutable Ledger Accounting</span>
                <p className="text-[11px] text-slate-400 mt-0.5">Dual-entry wallet tracking with complete transaction auditability.</p>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-white">Verified B2B Client Onboarding</span>
                <p className="text-[11px] text-slate-400 mt-0.5">Structured KYC validation and transparent compliance review.</p>
              </div>
            </div>
          </div>

          {/* Operational Verification Tag */}
          <div className="relative z-10 pt-4 text-[11px] text-slate-400 flex items-center gap-2">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Enterprise Security & Role-Based Access Control</span>
          </div>
        </div>

        {/* Right Form Card Column */}
        <div className={`lg:col-span-7 p-6 sm:p-10 flex flex-col justify-center ${mode === 'register' ? 'overflow-y-auto max-h-[85vh]' : ''}`}>
          <div className="w-full">
            {/* Top Switcher (Sign In vs Register) */}
            {(mode === 'login' || mode === 'register') && (
              <div className="flex border-b border-slate-200 mb-6">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setError(null);
                  }}
                  className={`pb-2.5 text-xs sm:text-sm font-semibold transition-colors mr-6 relative ${
                    mode === 'login'
                      ? 'text-emerald-700 border-b-2 border-emerald-600'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Portal Sign In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setError(null);
                  }}
                  className={`pb-2.5 text-xs sm:text-sm font-semibold transition-colors relative ${
                    mode === 'register'
                      ? 'text-emerald-700 border-b-2 border-emerald-600'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Register Business Account
                </button>
              </div>
            )}

            {/* Form Header */}
            <div className="mb-6">
              <div className="lg:hidden flex items-center gap-2 mb-4">
                <div className="w-7 h-7 rounded bg-emerald-700 flex items-center justify-center font-bold text-white text-xs">
                  SA
                </div>
                <span className="font-bold text-slate-900">Ship Asaan</span>
              </div>

              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                {mode === 'login' && 'Sign in to your account'}
                {mode === 'register' && 'Register your business with Ship Asaan'}
                {mode === 'forgot' && 'Reset your password'}
                {mode === 'reset' && 'Set a new password'}
              </h1>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                {mode === 'login' && 'Access the fulfillment operations portal with your registered email.'}
                {mode === 'register' && 'Submit your business details for warehouse fulfillment clearance and KYC review.'}
                {mode === 'forgot' && 'Enter your email address and we will dispatch a secure 6-digit code.'}
                {mode === 'reset' && 'Enter the verification code and configure your new secure password.'}
              </p>
            </div>

            {/* Notifications */}
            {error && (
              <div className="mb-4">
                <Notice variant="error" message={error} onDismiss={() => setError(null)} />
              </div>
            )}

            {notice && (
              <div className="mb-4">
                <Notice variant="success" message={notice} onDismiss={() => setNotice(null)} />
              </div>
            )}

            {devOtpHint && mode === 'reset' && (
              <div className="mb-4">
                <Notice
                  variant="info"
                  title="Local Development OTP"
                  message={`Verification code: ${devOtpHint}`}
                />
              </div>
            )}

            {/* Mode 1: Login */}
            {mode === 'login' && (
              <form onSubmit={handleLogin} className="space-y-4">
                <Input
                  label="Email Address"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@shipasaan.com"
                  prefixIcon={<Mail className="w-4 h-4" />}
                />

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-700">
                      Password <span className="text-rose-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setMode('forgot');
                        setError(null);
                        setNotice(null);
                      }}
                      className="text-xs text-emerald-700 hover:text-emerald-800 font-medium transition-colors"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <Input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    prefixIcon={<Lock className="w-4 h-4" />}
                  />
                </div>

                <div className="pt-2">
                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    loading={loading}
                    className="w-full"
                    icon={<ArrowRight className="w-4 h-4" />}
                  >
                    Sign In
                  </Button>
                </div>
              </form>
            )}

            {/* Mode 2: Register Customer */}
            {mode === 'register' && (
              <form onSubmit={handleRegister} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    label="Authorized Representative Name"
                    required
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="e.g. Tariq Mehmood"
                    prefixIcon={<User className="w-4 h-4" />}
                  />

                  <Input
                    label="Corporate Email Address"
                    type="email"
                    required
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="tariq@brandname.pk"
                    prefixIcon={<Mail className="w-4 h-4" />}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    label="Registered Legal Entity Name"
                    required
                    value={regBusinessName}
                    onChange={(e) => setRegBusinessName(e.target.value)}
                    placeholder="e.g. Mehmood Traders Pvt Ltd"
                    prefixIcon={<Building className="w-4 h-4" />}
                  />

                  <Input
                    label="Customer Brand / Store Name"
                    required
                    value={regBrandName}
                    onChange={(e) => setRegBrandName(e.target.value)}
                    placeholder="e.g. Mehmood Apparel"
                    prefixIcon={<Building className="w-4 h-4" />}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    label="CNIC or NTN Number"
                    required
                    value={regCnic}
                    onChange={(e) => setRegCnic(e.target.value)}
                    placeholder="35201-1234567-1 or 1234567-8"
                    prefixIcon={<FileText className="w-4 h-4" />}
                  />

                  <Input
                    label="Business Contact Mobile"
                    required
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    placeholder="0300-1234567"
                    prefixIcon={<Phone className="w-4 h-4" />}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <Input
                      label="Physical Dispatch / Office Address"
                      required
                      value={regAddress}
                      onChange={(e) => setRegAddress(e.target.value)}
                      placeholder="Plot 14, Commercial Sector B, Industrial Area"
                      prefixIcon={<MapPin className="w-4 h-4" />}
                    />
                  </div>

                  <Input
                    label="Operating City"
                    required
                    value={regCity}
                    onChange={(e) => setRegCity(e.target.value)}
                    placeholder="Karachi, Lahore..."
                    prefixIcon={<MapPin className="w-4 h-4" />}
                  />
                </div>

                <Input
                  label="Create Account Password"
                  type="password"
                  required
                  minLength={8}
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  prefixIcon={<Lock className="w-4 h-4" />}
                  helperText="Password must be at least 8 characters long."
                />

                <div className="pt-2">
                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    loading={loading}
                    className="w-full"
                    icon={<ArrowRight className="w-4 h-4" />}
                  >
                    Submit Business Application
                  </Button>
                </div>
              </form>
            )}

            {/* Mode 3: Forgot Password */}
            {mode === 'forgot' && (
              <form onSubmit={handleRequestOtp} className="space-y-4">
                <Input
                  label="Registered Account Email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  prefixIcon={<Mail className="w-4 h-4" />}
                  helperText="A single-use 6-digit code will be generated for password verification."
                />

                <div className="pt-2 flex items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="md"
                    className="w-1/2"
                    onClick={() => {
                      setMode('login');
                      setError(null);
                    }}
                    icon={<ArrowLeft className="w-4 h-4" />}
                  >
                    Back
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    loading={loading}
                    className="w-1/2"
                  >
                    Send OTP Code
                  </Button>
                </div>
              </form>
            )}

            {/* Mode 4: Reset Password with OTP */}
            {mode === 'reset' && (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <Input
                  label="6-Digit Verification Code"
                  type="text"
                  required
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="123456"
                  className="text-center font-mono text-base tracking-widest"
                  prefixIcon={<KeyRound className="w-4 h-4" />}
                />

                <Input
                  label="New Password"
                  type="password"
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  prefixIcon={<Lock className="w-4 h-4" />}
                  helperText="Must be minimum 8 characters long."
                />

                <div className="pt-2 flex items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="md"
                    className="w-1/2"
                    onClick={() => {
                      setMode('login');
                      setError(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    loading={loading}
                    className="w-1/2"
                  >
                    Set Password
                  </Button>
                </div>
              </form>
            )}

            {/* Footnote */}
            <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>Root Administrator:</span>
              <span className="font-mono text-slate-700 font-medium">admin@shipasaan.com</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
