"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { X, Mail, Eye, EyeOff } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { createBrowserSupabase } from "@/utils/supabase/client"

const supabase = createBrowserSupabase()

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
  mode?: "login" | "signup"
}

export function AuthModal({ isOpen, onClose, mode = "signup" }: AuthModalProps) {
  const [activeTab, setActiveTab] = useState(mode)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  const resetForm = () => {
    setEmail("")
    setPassword("")
    setShowPassword(false)
    setIsLoading(false)
  }

  useEffect(() => {
    setActiveTab(mode)
  }, [mode])

  useEffect(() => {
    if (!isOpen) {
      resetForm()
      setActiveTab(mode)
    }
  }, [isOpen, mode])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        toast({ title: "Sign In Failed", description: error.message, variant: "destructive" })
      } else {
        toast({ title: "Welcome back!", description: "You've been signed in successfully." })
        resetForm()
        onClose()
      }
    } catch {
      toast({ title: "Sign In Failed", description: "An unexpected error occurred.", variant: "destructive" })
    }
    setIsLoading(false)
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/auth/confirm` },
      })
      if (error) {
        toast({ title: "Sign Up Failed", description: error.message, variant: "destructive" })
      } else {
        if (data.user && data.session) {
          toast({ title: "Account created!", description: "Welcome to CARMA! You're now signed in." })
        } else {
          toast({ title: "Account created!", description: "Please check your email to confirm your account." })
        }
        resetForm()
        onClose()
      }
    } catch {
      toast({ title: "Sign Up Failed", description: "An unexpected error occurred.", variant: "destructive" })
    }
    setIsLoading(false)
  }

  const handleSocialAuth = async (provider: "google" | "azure") => {
    try {
      await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      })
    } catch {
      toast({
        title: `${provider} Authentication`,
        description: "Could not initiate sign-in. Please try again.",
        variant: "destructive",
      })
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="theme-b sm:max-w-[420px] p-0 gap-0 bg-background border border-border rounded-2xl shadow-2xl [&>button]:hidden">
        <div className="p-8">
          {/* Close button */}
          <div className="flex justify-end mb-2">
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-border mb-8">
            <button
              onClick={() => setActiveTab("signup")}
              className={`flex-1 pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "signup"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              Sign Up
            </button>
            <button
              onClick={() => setActiveTab("login")}
              className={`flex-1 pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "login"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              Sign In
            </button>
          </div>

          <h2 className="text-2xl font-bold mb-6">
            {activeTab === "signup" ? "Create your account" : "Welcome back"}
          </h2>

          {/* Social buttons */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <Button
              variant="outline"
              className="h-11"
              onClick={() => handleSocialAuth("google")}
              disabled={isLoading}
            >
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Google
            </Button>
            <Button
              variant="outline"
              className="h-11"
              onClick={() => handleSocialAuth("azure")}
              disabled={isLoading}
            >
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                <path fill="#00BCF2" d="M11.4 24H0V12.6h11.4V24zM24 24H12.6V12.6H24V24zM11.4 11.4H0V0h11.4v11.4zM24 11.4H12.6V0H24v11.4z" />
              </svg>
              Microsoft
            </Button>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground uppercase font-medium">or</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Form */}
          <form onSubmit={activeTab === "signup" ? handleSignup : handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 h-11 bg-background border-border"
                  placeholder="you@example.com"
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Password</label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-10 h-11 bg-background border-border"
                  placeholder={activeTab === "signup" ? "Create a password" : "Enter your password"}
                  required
                  minLength={6}
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full h-11 mt-2" disabled={isLoading}>
              {isLoading
                ? activeTab === "signup"
                  ? "Creating account..."
                  : "Signing in..."
                : activeTab === "signup"
                  ? "Create account"
                  : "Sign in"
              }
            </Button>
          </form>

          <p className="text-center text-xs text-muted-foreground mt-6">
            By continuing, you agree to CARMA&apos;s Terms of Service and Privacy Policy.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
