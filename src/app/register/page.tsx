
'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { UserPlus, Loader2, Mail, KeyRound, User, Building } from 'lucide-react';

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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { auth } from '@/lib/firebase'; // Import Firebase auth instance
import { saveUserProfile, type UserProfileData } from '@/services/firestore'; // Import Firestore service

// Define available departments
const departments = [
  'Computer Science',
  'Electrical Engineering',
  'Mechanical Engineering',
  'Civil Engineering',
  'Arts & Humanities',
  'Business Administration',
  'Life Sciences',
  'Other', // Add an 'Other' option
];

const registrationFormSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters.' }),
  email: z.string().email({ message: 'Please enter a valid email address.' }),
  department: z.string().min(1, { message: 'Please select your department.' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters.' }),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"], // path of error
});

type RegistrationFormValues = z.infer<typeof registrationFormSchema>;

export default function RegistrationPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = React.useState(false);

  const form = useForm<RegistrationFormValues>({
    resolver: zodResolver(registrationFormSchema),
    defaultValues: {
      name: '',
      email: '',
      department: '',
      password: '',
      confirmPassword: '',
    },
  });

  async function onSubmit(data: RegistrationFormValues) {
    setIsLoading(true);
    try {
      // 1. Create user in Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
      const user = userCredential.user;

      // 2. Save additional user profile data to Firestore
      const userProfile: UserProfileData = {
        name: data.name,
        email: data.email,
        department: data.department,
      };
      await saveUserProfile(user.uid, userProfile);

      toast({
        title: 'Registration Successful',
        description: 'Your account has been created. Please log in.',
      });

      // Redirect to the login page after successful registration
      router.push('/login');

    } catch (error: any) {
      console.error('Registration error:', error);
       let errorMessage = 'An unexpected error occurred during registration.';
       // Map Firebase auth errors to user-friendly messages
       switch (error.code) {
         case 'auth/email-already-in-use':
           errorMessage = 'This email address is already registered. Please try logging in.';
           break;
         case 'auth/invalid-email':
           errorMessage = 'Please enter a valid email address.';
           break;
         case 'auth/weak-password':
           errorMessage = 'Password is too weak. Please choose a stronger password (at least 6 characters).';
            break;
         case 'auth/network-request-failed':
              errorMessage = 'Network error. Please check your connection and try again.';
              break;
         case 'auth/requests-to-this-api-identitytoolkit-method-google.cloud.identitytoolkit.v1.authenticationservice.signup-are-blocked':
              errorMessage = 'Registration is currently disabled. Please ensure "Identity Toolkit API" is enabled in your Google Cloud Project and "Email/Password" sign-in is enabled in Firebase Authentication settings.';
              break;
         case 'auth/api-key-not-valid':
              errorMessage = 'Firebase API Key is not valid. Please check your environment configuration.';
              break;
         default:
            // Check if it's a Firestore error during profile saving
            if (error.message && error.message.includes('Failed to save user profile')) {
                errorMessage = 'Account created, but failed to save profile details. Please contact support.';
            } else if (error.message && error.message.toLowerCase().includes("api key not valid")) {
                errorMessage = 'Firebase API Key is not valid. Please check your environment configuration.';
            }
            // Otherwise, use the default message
            break;
       }

      toast({
        title: 'Registration Failed',
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
          <CardTitle className="text-2xl font-bold text-primary">Register</CardTitle>
          <CardDescription>Create a new HallPass account.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                     <FormLabel className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground"/> Full Name
                     </FormLabel>
                    <FormControl>
                      <Input placeholder="Your full name" {...field} disabled={isLoading} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                     <FormLabel className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground"/> Email Address
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
                name="department"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                        <Building className="h-4 w-4 text-muted-foreground"/> Department
                    </FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isLoading}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select your department" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {departments.map((dept) => (
                          <SelectItem key={dept} value={dept}>
                            {dept}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                        placeholder="Choose a secure password"
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
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                        <KeyRound className="h-4 w-4 text-muted-foreground"/> Confirm Password
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="Re-enter your password"
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
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Registering...
                  </>
                ) : (
                   <>
                     <UserPlus className="mr-2 h-4 w-4" /> Register
                   </>
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
         <CardFooter className="flex flex-col items-center justify-center text-sm text-muted-foreground">
           <p>
             Already have an account?{' '}
             <Link href="/login" className="font-medium text-primary underline underline-offset-4 hover:text-primary/90">
               Login here
             </Link>
           </p>
        </CardFooter>
      </Card>
    </main>
  );
}
