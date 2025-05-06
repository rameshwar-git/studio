import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
    ],
  },
   webpack: (config, { isServer }) => {
    // Allow 'crypto' module to be bundled for edge functions if needed
    // Note: The current implementation uses crypto server-side, so this might not be strictly necessary yet.
    if (!isServer) {
        // Resolve 'crypto' to the browser version or a polyfill if needed for client-side.
        // For server-side usage (like in page.tsx), Node's built-in crypto is used.
        // config.resolve.fallback = {
        //   ...config.resolve.fallback,
        //   crypto: require.resolve('crypto-browserify'), // Example using polyfill
        // };
    }

    // Important: return the modified config
    return config;
  },
};

export default nextConfig;
