
'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { LogIn, Loader2, Mail, KeyRound } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { auth } from '@/lib/firebase'; // Import Firebase auth instance

const loginFormSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email address.' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters.' }),
});

type LoginFormValues = z.infer<typeof loginFormSchema>;

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = React.useState(false);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  async function onSubmit(data: LoginFormValues) {
    setIsLoading(true);
    try {
      await signInWithEmailAndPassword(auth, data.email, data.password);
      toast({
        title: 'Login Successful',
        description: 'Welcome back!',
      });
      // Redirect to the main booking page or a dashboard after successful login
      router.push('/');
    } catch (error: any) {
      console.error('Login error:', error);
      let errorMessage = 'An unexpected error occurred during login.';
      // Map Firebase auth errors to user-friendly messages
      switch (error.code) {
        case 'auth/user-not-found':
        case 'auth/wrong-password':
           errorMessage = 'Invalid email or password. Please try again.';
           break;
        case 'auth/invalid-email':
            errorMessage = 'Please enter a valid email address.';
            break;
        case 'auth/too-many-requests':
            errorMessage = 'Too many login attempts. Please try again later.';
            break;
        case 'auth/network-request-failed':
             errorMessage = 'Network error. Please check your connection and try again.';
             break;
        default:
           // Use the default message for other errors
           break;
      }
      toast({
        title: 'Login Failed',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="container mx-auto flex min-h-screen flex-col items-center justify-center p-4 md:p-8">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-primary">Login</CardTitle>
          <CardDescription>Access your HallPass account.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground"/> Email
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="your.email@university.edu"
                        {...field}
                        disabled={isLoading}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                     <FormLabel className="flex items-center gap-2">
                        <KeyRound className="h-4 w-4 text-muted-foreground"/> Password
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="••••••••"
                        {...field}
                        disabled={isLoading}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={isLoading} className="w-full">
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Logging in...
                  </>
                ) : (
                   <>
                     <LogIn className="mr-2 h-4 w-4" /> Login
                   </>
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
         <CardFooter className="flex flex-col items-center justify-center text-sm text-muted-foreground">
          <p>
             Don't have an account?{' '}
             <Link href="/register" className="font-medium text-primary underline underline-offset-4 hover:text-primary/90">
                Register here
             </Link>
          </p>
        </CardFooter>
      </Card>
    </main>
  );
}
