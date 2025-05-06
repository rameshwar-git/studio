import {NextRequest} from 'next/server';
import {ai} from '@/ai/genkit'; // Import the globally configured ai instance
import '@/ai/flows/authorize-booking'; // Ensure flow is registered

// The genkit() call is no longer needed here as `ai` is already configured globally.

export async function GET(
  req: NextRequest,
  {params}: {params: {slug: string[]}}
) {
  return ai.handleApiRequest(req, {params});
}

export async function POST(
  req: NextRequest,
  {params}: {params: {slug: string[]}}
) {
  return ai.handleApiRequest(req, {params});
}

export async function OPTIONS(
  req: NextRequest,
  {params}: {params: {slug: string[]}}
) {
  return ai.handleApiRequest(req, {params});
}

export async function HEAD(
  req: NextRequest,
  {params}: {params: {slug: string[]}}
) {
  return ai.handleApiRequest(req, {params});
}
