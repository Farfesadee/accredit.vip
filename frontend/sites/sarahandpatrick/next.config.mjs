/** @type {import('next').NextConfig} */
const nextConfig = {
  // A pure static export: cPanel shared hosting serves HTML, CSS and JS from
  // public_html. No Node runtime, no Passenger, no idle restarts.
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  experimental: { externalDir: true },
  // The guest pages post to the platform API, which is where the guest list
  // lives. Kept in the config rather than a dotenv file so it is committed
  // alongside the site and cannot drift.
  env: {
    NEXT_PUBLIC_API_URL:
      process.env.NEXT_PUBLIC_API_URL || "https://accredit.vip/api/v1",
  },
};

export default nextConfig;
