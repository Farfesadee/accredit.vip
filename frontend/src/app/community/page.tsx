"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Navbar } from "@/components/shared/navbar";
import { Footer } from "@/components/shared/footer";
import { ErrorBoundary } from "@/components/shared/error-boundary";
import { API_BASE } from "@/lib/api-client";

interface Post {
  id: number;
  title: string;
  excerpt: string | null;
  tag: string | null;
  image: string | null;
  author: string | null;
  created_at: string;
}

function CommunityContent() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [subMsg, setSubMsg] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/posts`);
        if (res.ok) {
          const data = await res.json();
          setPosts(data);
        }
      } catch { /* ignore */ }
      setLoading(false);
    })();
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Navbar variant="light" />

      <section className="bg-[#0D1B2A] py-6 px-4 text-center">
        <h1 className="text-4xl sm:text-5xl font-extrabold text-white mb-2">Community</h1>
        <p className="text-white/60 text-lg max-w-2xl mx-auto">
          Event stories, charity initiatives, behind-the-scenes coverage of events we&apos;ve accredited,
          and conversations shaping Africa&apos;s event industry.
        </p>
      </section>

      <div className="flex-1 max-w-4xl mx-auto px-4 py-16">
        {loading ? (
          <p className="text-gray-400 text-center">Loading posts...</p>
        ) : posts.length === 0 ? (
          <div className="text-center">
            <p className="text-gray-400">No posts yet.</p>
            <Link href="/contact" className="text-[#1ABC9C] font-semibold hover:underline text-sm">Share your story</Link>
          </div>
        ) : (
          <div className="grid gap-8">
            {posts.map((post) => (
              <article key={post.id} className="rounded-2xl border border-[#e8edf2] p-6 sm:p-8 hover:shadow-lg transition-shadow">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#1ABC9C]">{post.tag || "Community"}</span>
                  <span className="text-xs text-gray-400">
                    {post.created_at
                      ? new Date(post.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })
                      : ""}
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-[#0D1B2A] mb-3">{post.title}</h2>
                {post.excerpt && <p className="text-gray-500 text-sm leading-relaxed">{post.excerpt}</p>}
                {post.image && (
                  <div className="mt-4 rounded-xl overflow-hidden max-h-72">
                    {post.image.match(/\.(mp4|webm|ogg|mov)$/i) ? (
                      <video src={post.image.startsWith("http") ? post.image : `${API_BASE.replace("/api/v1", "")}${post.image}`} controls className="w-full max-h-72 object-cover" />
                    ) : (
                      <img src={post.image.startsWith("http") ? post.image : `${API_BASE.replace("/api/v1", "")}${post.image}`} alt="" className="w-full max-h-72 object-cover" />
                    )}
                  </div>
                )}
                {post.author && <p className="text-xs text-gray-400 mt-3">By {post.author}</p>}
              </article>
            ))}
          </div>
        )}

        <div className="mt-12 text-center">
          <p className="text-gray-400 text-sm">
            Have a story to share?{" "}
            <Link href="/contact" className="text-[#1ABC9C] font-semibold hover:underline">Get in touch</Link>
          </p>
        </div>
      </div>

      <section className="max-w-4xl mx-auto px-4 py-16 text-center">
        <h2 className="text-2xl font-bold text-[#0D1B2A] mb-2">Get Event Notifications</h2>
        <p className="text-gray-500 text-sm mb-6">Be the first to know when new events and free tickets are posted.</p>
        <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto mb-3">
          <input
            type="email" placeholder="your@email.com" value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="flex-1 px-4 py-2.5 rounded-xl border border-[#d9e2ec] text-sm outline-none focus:border-[#1ABC9C]"
          />
          <input
            type="tel" placeholder="+234..." value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="flex-1 px-4 py-2.5 rounded-xl border border-[#d9e2ec] text-sm outline-none focus:border-[#1ABC9C]"
          />
        </div>
        <button
          onClick={async () => {
            if (!email && !phone) return;
            const channels = [];
            if (email) channels.push("email");
            if (phone) channels.push("sms", "whatsapp");
            try {
              await fetch(`${API_BASE}/subscribe`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: email || null, phone: phone || null, channels: channels.join(",") }),
              });
              setSubMsg("Subscribed successfully!");
              setEmail(""); setPhone("");
            } catch { setSubMsg("Something went wrong. Try again."); }
            setTimeout(() => setSubMsg(""), 3000);
          }}
          className="inline-flex items-center justify-center rounded-xl bg-[#1ABC9C] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#16A085] transition-colors"
        >
          Subscribe
        </button>
        {subMsg && <p className="text-sm mt-2" style={{ color: "#16a34a" }}>{subMsg}</p>}
      </section>

      <Footer />
    </div>
  );
}

export default function CommunityPage() {
  return (
    <ErrorBoundary>
      <CommunityContent />
    </ErrorBoundary>
  );
}
