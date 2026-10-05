/* بيانات العميل: تُعدَّل جميع بيانات الدعوة من هذا الكائن فقط.
   القيم null تعني أن البيانات لم تُؤكَّد، ولا تمثل بيانات عميل افتراضي.
   eventStart/eventEnd: توقيت ISO متضمن إزاحة المنطقة، مثل 2027-07-15T18:00:00+03:00.
   timeZone: اسم IANA مثل Asia/Baghdad. mapsUrl: رابط الموقع المعتمد. */
const CLIENT = {
  graduateName: null,
  degree: null,
  university: null,
  faculty: null,
  department: null,
  classYear: null,
  invitation: "يسرّنا دعوتكم لمشاركتنا فرحة التخرّج وبداية فصل جديد.",
  signatureCaption: "ثمرة أعوام من المثابرة",
  closing: "حضوركم أجمل ما يُضاف إلى هذا الإنجاز",
  venue: null,
  address: null,
  eventStart: null,
  eventEnd: null,
  timeZone: null,
  mapsUrl: null,
  shareUrl: null, // تُستخدم وصلة الصفحة المنشورة عند ترك القيمة null.
};

(() => {
  "use strict";
  const $ = (selector) => document.querySelector(selector);
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const locale = "ar-IQ";
  const copy = {
    calendar: "تم تنزيل موعد الحفل. افتح الملف لإضافته إلى التقويم.",
    missing: "تفاصيل الحفل لم تُعتمد بعد.",
    copied: "تم نسخ رابط الدعوة.",
    manual: "يمكنك تحديد رابط الدعوة أدناه ونسخه.",
    error: "تعذّر تنزيل الموعد. يرجى المحاولة مجدداً.",
  };
  document.querySelectorAll("[data-field]").forEach((node) => {
    const key = node.dataset.field;
    if (CLIENT[key])
      node.textContent =
        key === "classYear"
          ? `دفعة ${String(CLIENT[key]).replace(/\d/g, (n) => "٠١٢٣٤٥٦٧٨٩"[n])}`
          : CLIENT[key];
  });
  if (CLIENT.graduateName)
    document.title = `${CLIENT.graduateName} — دعوة تخرّج`;
  const parseDate = (value) =>
    typeof value === "string" &&
    /(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
    Number.isFinite(Date.parse(value))
      ? new Date(value)
      : null;
  const start = parseDate(CLIENT.eventStart),
    end = parseDate(CLIENT.eventEnd);
  let validZone = false;
  try {
    if (CLIENT.timeZone) {
      new Intl.DateTimeFormat(locale, { timeZone: CLIENT.timeZone }).format();
      validZone = true;
    }
  } catch (_) {
    /* الاحتفاظ بنص النسخة الثابتة عند عدم اعتماد المنطقة الزمنية. */
  }
  if (start && validZone) {
    const fmt = (options) =>
      new Intl.DateTimeFormat(locale, {
        ...options,
        timeZone: CLIENT.timeZone,
      }).format(start);
    $("#event-date").textContent = fmt({
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    $("#event-time").textContent = fmt({
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZoneName: "short",
    });
  }
  const safeUrl = (value) => {
    try {
      const u = new URL(value);
      return u.protocol === "https:" || u.protocol === "http:" ? u.href : null;
    } catch (_) {
      return null;
    }
  };
  const mapUrl = CLIENT.mapsUrl && safeUrl(CLIENT.mapsUrl);
  if (mapUrl) {
    $("#maps").href = mapUrl;
    $("#maps").removeAttribute("aria-disabled");
  } else
    $("#maps").addEventListener("click", (e) => {
      e.preventDefault();
      feedback(copy.missing);
    });
  const calendarReady =
    start &&
    end &&
    end > start &&
    validZone &&
    CLIENT.graduateName &&
    CLIENT.venue &&
    CLIENT.address;
  $("#calendar").setAttribute("aria-disabled", String(!calendarReady));
  function feedback(message) {
    $("#feedback").textContent = message;
  }

  // RFC 5545: UTF-8-safe folding, escaped text, CRLF and absolute UTC times.
  const escapeICS = (text) =>
    String(text)
      .replace(/\\/g, "\\\\")
      .replace(/\r?\n/g, "\\n")
      .replace(/;/g, "\\;")
      .replace(/,/g, "\\,");
  const utc = (date) =>
    date
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "");
  const fold = (line) => {
    let result = "",
      chunk = "",
      bytes = 0;
    for (const char of line) {
      const size = new TextEncoder().encode(char).length;
      if (bytes + size > 75) {
        result += `${chunk}\r\n`;
        chunk = " ";
        bytes = 1;
      }
      chunk += char;
      bytes += size;
    }
    return result + chunk;
  };
  $("#calendar").addEventListener("click", () => {
    if (!calendarReady) {
      feedback(copy.missing);
      return;
    }
    try {
      const lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Graduation Invitation//AR",
        "CALSCALE:GREGORIAN",
        "BEGIN:VEVENT",
        `UID:grad-010-${start.getTime()}@${location.hostname || "invitation.local"}`,
        `DTSTAMP:${utc(new Date())}`,
        `DTSTART:${utc(start)}`,
        `DTEND:${utc(end)}`,
        `SUMMARY:${escapeICS(`حفل تخرّج ${CLIENT.graduateName}`)}`,
        `DESCRIPTION:${escapeICS(CLIENT.invitation)}`,
        `LOCATION:${escapeICS(`${CLIENT.venue}، ${CLIENT.address}`)}`,
        `URL:${escapeICS(invitationUrl())}`,
        "END:VEVENT",
        "END:VCALENDAR",
      ];
      const url = URL.createObjectURL(
        new Blob([lines.map(fold).join("\r\n") + "\r\n"], {
          type: "text/calendar;charset=utf-8",
        }),
      );
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "graduation.ics";
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      feedback(copy.calendar);
    } catch (_) {
      feedback(copy.error);
    }
  });
  function invitationUrl() {
    return safeUrl(CLIENT.shareUrl) || location.href.split("#")[0];
  }
  $("#share").addEventListener("click", async () => {
    const url = invitationUrl();
    if (navigator.share) {
      try {
        await navigator.share({
          title: document.title,
          text: CLIENT.invitation,
          url,
        });
        return;
      } catch (e) {
        if (e.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      feedback(copy.copied);
    } catch (_) {
      $("#share-fallback").hidden = false;
      $("#share-url").value = url;
      $("#share-url").focus();
      $("#share-url").select();
      feedback(copy.manual);
    }
  });
  $("#close-share").addEventListener("click", () => {
    $("#share-fallback").hidden = true;
    feedback("");
    $("#share").focus();
  });

  // The default document is fully visible. Animation is a progressive enhancement.
  // Animate whole HTML blocks only: Arabic glyphs are never split, masked or clipped.
  let timeline;
  const drawings = [...document.querySelectorAll(".draw, .signature-line")];
  const reveals = [
    ".certificate-head",
    ".recipient",
    ".seal",
    ".signature",
    ".invitation",
    ".document-footer",
  ];
  function restore() {
    if (timeline) timeline.kill();
    [...drawings, ...reveals.map((selector) => $(selector))].forEach((node) => {
      node.style.removeProperty("opacity");
      node.style.removeProperty("transform");
      node.style.removeProperty("stroke-dasharray");
      node.style.removeProperty("stroke-dashoffset");
      node.style.removeProperty("visibility");
    });
  }
  if (window.gsap && !reduced.matches) {
    try {
      gsap.set(drawings, { strokeDasharray: 1, strokeDashoffset: 1 });
      gsap.set(reveals, { opacity: 0 });
      timeline = gsap.timeline({ onComplete: restore });
      timeline
        .to(".draw", {
          strokeDashoffset: 0,
          duration: 1.5,
          stagger: 0.1,
          ease: "power2.inOut",
        })
        .to(".certificate-head", { opacity: 1, duration: 0.7 }, 0.45)
        .to(".recipient", { opacity: 1, duration: 0.7 }, 1.2)
        .fromTo(
          ".seal",
          { scale: 1.04 },
          { scale: 1, opacity: 1, duration: 0.8, ease: "power2.out" },
          1.9,
        )
        .to(".signature", { opacity: 1, duration: 0.2 }, 2.1)
        .to(
          ".signature-line",
          { strokeDashoffset: 0, duration: 1.2, ease: "power1.inOut" },
          2.1,
        )
        .to(
          ".invitation, .document-footer",
          { opacity: 1, duration: 1, stagger: 0.15 },
          2.9,
        );
      // Fail open even if an external animation library stops unexpectedly.
      setTimeout(restore, 6500);
    } catch (_) {
      restore();
    }
  }
  const motionChanged = () => {
    if (reduced.matches) restore();
  };
  if (reduced.addEventListener)
    reduced.addEventListener("change", motionChanged);
  else if (reduced.addListener) reduced.addListener(motionChanged);
})();
