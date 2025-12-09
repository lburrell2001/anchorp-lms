// supabase/functions/notify-course-created/index.ts

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

type CourseRecord = {
  id: string;
  title: string;
  slug?: string | null;
  audience: "internal" | "external" | "both" | null;
  description?: string | null;
  created_at?: string;
};

serve(async (req) => {
  try {
    const body = await req.json();
    const course: CourseRecord = body.record;

    // Only notify external users
    if (course.audience !== "external" && course.audience !== "both") {
      return new Response(
        JSON.stringify({ message: "Course is not external. Skipping." }),
        { status: 200 }
      );
    }

    // 1) Fetch all external profiles
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, email, user_type")
      .eq("user_type", "external");

    if (profilesError) {
      console.error("Profile fetch error:", profilesError);
      return new Response("Error fetching profiles", { status: 500 });
    }

    // 2) Fetch settings (who wants notifications)
    const { data: settings, error: settingsError } = await supabase
      .from("user_settings")
      .select("user_id, email_notifications")
      .eq("email_notifications", true);

    if (settingsError) {
      console.error("Settings fetch error:", settingsError);
      return new Response("Error fetching settings", { status: 500 });
    }

    const allowedUserIds = new Set(settings.map((s) => s.user_id));

    // 3) Filter final email list
    const emails = profiles
      .filter((p: any) => allowedUserIds.has(p.id) && p.email)
      .map((p: any) => p.email);

    if (emails.length === 0) {
      return new Response(
        JSON.stringify({
          message: "No external users with notifications enabled.",
        }),
        { status: 200 }
      );
    }

    // 4) Compose email
    const subject = `New course available: ${course.title}`;
    const courseUrl = course.slug
      ? `https://your-lms-domain.com/courses/${course.slug}`
      : "https://your-lms-domain.com/courses";

    const html = `
      <div style="font-family: sans-serif;">
        <h2 style="color:#064e3b;">New External Course Published</h2>
        <p>A new training course has been added to the LMS:</p>
        <h3>${course.title}</h3>

        ${
          course.description
            ? `<p style="color:#555;">${course.description}</p>`
            : ""
        }

        <a href="${courseUrl}" style="
          padding: 10px 16px;
          background: #047857;
          color: white;
          text-decoration: none;
          border-radius: 8px;
          display:inline-block;
        ">View course</a>

        <p style="font-size: 12px; color:#666; margin-top:20px;">
          You are receiving this because your email notifications are enabled.
        </p>
      </div>
    `;

    // 5) Send via Resend
    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "AnchorP LMS <no-reply@yourdomain.com>",
        to: emails,
        subject,
        html,
      }),
    });

    if (!emailRes.ok) {
      const errorText = await emailRes.text();
      console.error("Resend API error:", errorText);
      return new Response("Failed to send email", { status: 500 });
    }

    return new Response(
      JSON.stringify({ message: "Emails sent", count: emails.length }),
      { status: 200 }
    );
  } catch (err) {
    console.error("Function error:", err);
    return new Response("Internal error", { status: 500 });
  }
});
