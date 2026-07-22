import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { getStore } from "../store.js";

const composer = new Composer<Ctx>();

function getAvailableSlots(date: string, serviceDurationMinutes: number): string[] {
  const slots: string[] = [];
  const durationHours = serviceDurationMinutes / 60;
  for (let h = 9; h < 18; h++) {
    const slotEnd = h + durationHours;
    if (slotEnd <= 18) {
      slots.push(`${String(h).padStart(2, "0")}:00`);
    }
  }
  return slots;
}

async function showServiceList(ctx: Ctx) {
  const store = getStore();
  const services = await store.getServices();
  if (services.length === 0) {
    await ctx.reply("No services available yet — check back soon!", {
      reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]),
    });
    return;
  }
  const rows = services.map((s) => [
    inlineButton(`${s.name} — ${s.price_label}`, `booking:pick:${s.id}`),
  ]);
  rows.push([inlineButton("⬅️ Back to menu", "menu:main")]);
  await ctx.reply("Pick a service to book:", {
    reply_markup: inlineKeyboard(rows),
  });
}

composer.callbackQuery("booking:services", async (ctx) => {
  await ctx.answerCallbackQuery();
  ctx.session.step = "booking_service";
  await showServiceList(ctx);
});

composer.callbackQuery(/^booking:pick:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const serviceId = ctx.match[1];
  const store = getStore();
  const service = await store.getService(serviceId);
  if (!service) {
    await ctx.reply("Sorry, that service is no longer available.", {
      reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]),
    });
    return;
  }
  ctx.session.booking_service_id = serviceId;
  ctx.session.step = "booking_date";

  const today = new Date();
  const rows: ReturnType<typeof inlineButton>[][] = [];
  for (let d = 0; d < 7; d++) {
    const date = new Date(today);
    date.setDate(today.getDate() + d);
    const dateStr = date.toISOString().split("T")[0];
    const label = d === 0 ? "Today" : d === 1 ? "Tomorrow" : date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    rows.push([inlineButton(label, `booking:date:${dateStr}`)]);
  }
  rows.push([inlineButton("⬅️ Back", "booking:services")]);

  await ctx.reply(`📅 When would you like your ${service.name}?`, {
    reply_markup: inlineKeyboard(rows),
  });
});

composer.callbackQuery(/^booking:date:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const dateStr = ctx.match[1];
  ctx.session.booking_date = dateStr;
  ctx.session.step = "booking_slot";

  const store = getStore();
  const service = await store.getService(ctx.session.booking_service_id!);
  if (!service) {
    await ctx.reply("Service not found.", {
      reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]),
    });
    return;
  }

  const allSlots = getAvailableSlots(dateStr, service.duration);
  const existingBookings = await store.getBookingsByDate(dateStr);
  const takenSlots = new Set(existingBookings.map((b) => b.slot));
  const availableSlots = allSlots.filter((s) => !takenSlots.has(s));

  if (availableSlots.length === 0) {
    await ctx.reply("No available slots on that date. Try another day.", {
      reply_markup: inlineKeyboard([
        [inlineButton("📅 Pick another date", `booking:pick:${service.id}`)],
        [inlineButton("⬅️ Back to menu", "menu:main")],
      ]),
    });
    return;
  }

  const rows = availableSlots.map((slot) => [
    inlineButton(slot, `booking:slot:${slot}`),
  ]);
  rows.push([inlineButton("⬅️ Back", `booking:pick:${service.id}`)]);

  const date = new Date(dateStr + "T00:00:00");
  const dateLabel = date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  await ctx.reply(`⏰ Pick a time on ${dateLabel}:`, {
    reply_markup: inlineKeyboard(rows),
  });
});

composer.callbackQuery(/^booking:slot:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const slot = ctx.match[1];
  ctx.session.booking_slot = slot;
  ctx.session.step = "booking_name";

  await ctx.reply("What's your name?", {
    reply_markup: { force_reply: true, input_field_placeholder: "Type your name…" },
  });
});

composer.on("message:text", async (ctx, next) => {
  if (ctx.session.step !== "booking_name") return next();
  const name = ctx.message.text.trim();
  if (name.length < 1) {
    await ctx.reply("Please enter your name.");
    return;
  }
  ctx.session.booking_name = name;
  ctx.session.step = "booking_phone";

  await ctx.reply("What's your phone number?", {
    reply_markup: { force_reply: true, input_field_placeholder: "Type your phone number…" },
  });
});

composer.on("message:text", async (ctx, next) => {
  if (ctx.session.step !== "booking_phone") return next();
  const phone = ctx.message.text.trim();
  if (phone.length < 5) {
    await ctx.reply("That doesn't look right — try again with a valid number.");
    return;
  }
  ctx.session.booking_phone = phone;
  ctx.session.step = "booking_confirm";

  const store = getStore();
  const service = await store.getService(ctx.session.booking_service_id!);
  const date = new Date(ctx.session.booking_date! + "T00:00:00");
  const dateLabel = date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  const summary =
    `📋 Confirm your booking:\n\n` +
    `Service: ${service?.name}\n` +
    `Date: ${dateLabel}\n` +
    `Time: ${ctx.session.booking_slot}\n` +
    `Name: ${ctx.session.booking_name}\n` +
    `Phone: ${phone}\n\n` +
    `Does everything look right?`;

  await ctx.reply(summary, {
    reply_markup: inlineKeyboard([
      [inlineButton("✅ Confirm", "booking:confirm:yes"), inlineButton("❌ Cancel", "booking:confirm:no")],
    ]),
  });
});

composer.callbackQuery("booking:confirm:yes", async (ctx) => {
  await ctx.answerCallbackQuery();
  const store = getStore();
  const booking = await store.addBooking({
    user_id: ctx.from!.id,
    client_name: ctx.session.booking_name!,
    phone: ctx.session.booking_phone!,
    service_id: ctx.session.booking_service_id!,
    date: ctx.session.booking_date!,
    slot: ctx.session.booking_slot!,
    status: "confirmed",
  });

  const service = await store.getService(booking.service_id);
  const date = new Date(booking.date + "T00:00:00");
  const dateLabel = date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  ctx.session.step = "idle";
  ctx.session.booking_service_id = undefined;
  ctx.session.booking_date = undefined;
  ctx.session.booking_slot = undefined;
  ctx.session.booking_name = undefined;
  ctx.session.booking_phone = undefined;

  await ctx.editMessageText(
    `✅ You're booked!\n\n` +
    `Service: ${service?.name}\n` +
    `Date: ${dateLabel}\n` +
    `Time: ${booking.slot}\n` +
    `Name: ${booking.client_name}\n\n` +
    `See you at the studio!`,
    { reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]) },
  );

  const adminChatId = await store.getAdminChatId();
  if (adminChatId) {
    try {
      await ctx.api.sendMessage(
        adminChatId,
        `📅 New booking!\n\n` +
        `Client: ${booking.client_name}\n` +
        `Phone: ${booking.phone}\n` +
        `Service: ${service?.name}\n` +
        `Date: ${dateLabel}\n` +
        `Time: ${booking.slot}`,
      );
    } catch {
      // Admin chat might not have started the bot
    }
  }
});

composer.callbackQuery("booking:confirm:no", async (ctx) => {
  await ctx.answerCallbackQuery();
  ctx.session.step = "idle";
  ctx.session.booking_service_id = undefined;
  ctx.session.booking_date = undefined;
  ctx.session.booking_slot = undefined;
  ctx.session.booking_name = undefined;
  ctx.session.booking_phone = undefined;

  await ctx.editMessageText("Booking cancelled. Tap /start to begin again.", {
    reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]),
  });
});

export default composer;
