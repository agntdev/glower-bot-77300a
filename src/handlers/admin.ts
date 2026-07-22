import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { getStore } from "../store.js";

const composer = new Composer<Ctx>();

composer.command("admin", async (ctx) => {
  ctx.session.step = "admin";
  ctx.session.admin_chat_id = ctx.chat.id;
  const store = getStore();
  await store.setAdminChatId(ctx.chat.id);

  await ctx.reply("⚙️ Admin panel", {
    reply_markup: inlineKeyboard([
      [inlineButton("➕ Add service", "admin:add_service")],
      [inlineButton("📋 Manage services", "admin:manage_services")],
      [inlineButton("🖼️ Add portfolio item", "admin:add_portfolio")],
      [inlineButton("📋 Manage portfolio", "admin:manage_portfolio")],
      [inlineButton("⭐ Respond to reviews", "admin:respond_reviews")],
      [inlineButton("⬅️ Back to menu", "menu:main")],
    ]),
  });
});

composer.callbackQuery("admin:add_service", async (ctx) => {
  await ctx.answerCallbackQuery();
  ctx.session.admin_step = "admin_service_name";
  await ctx.reply("What's the service name?", {
    reply_markup: { force_reply: true, input_field_placeholder: "e.g. Gel manicure" },
  });
});

composer.on("message:text", async (ctx, next) => {
  if (ctx.session.admin_step !== "admin_service_name") return next();
  const name = ctx.message.text.trim();
  if (name.length < 1) {
    await ctx.reply("Please enter a name.");
    return;
  }
  ctx.session.admin_step = "admin_service_duration";
  ctx.session.admin_service_id = name;

  await ctx.reply("How long is this service in minutes? (e.g. 60)", {
    reply_markup: { force_reply: true, input_field_placeholder: "Duration in minutes" },
  });
});

composer.on("message:text", async (ctx, next) => {
  if (ctx.session.admin_step !== "admin_service_duration") return next();
  const duration = parseInt(ctx.message.text.trim());
  if (isNaN(duration) || duration < 15) {
    await ctx.reply("Please enter a valid duration (at least 15 minutes).");
    return;
  }
  ctx.session.admin_step = "admin_service_price";
  ctx.session.booking_name = String(duration);

  await ctx.reply("What's the price label? (e.g. $50)", {
    reply_markup: { force_reply: true, input_field_placeholder: "e.g. $50" },
  });
});

composer.on("message:text", async (ctx, next) => {
  if (ctx.session.admin_step !== "admin_service_price") return next();
  const price = ctx.message.text.trim();
  if (price.length < 1) {
    await ctx.reply("Please enter a price.");
    return;
  }
  ctx.session.admin_step = "admin_service_desc";
  ctx.session.booking_phone = price;

  await ctx.reply("Describe the service:", {
    reply_markup: { force_reply: true, input_field_placeholder: "Brief description" },
  });
});

composer.on("message:text", async (ctx, next) => {
  if (ctx.session.admin_step !== "admin_service_desc") return next();
  const desc = ctx.message.text.trim();
  const store = getStore();
  const service = await store.addService({
    name: ctx.session.admin_service_id!,
    duration: parseInt(ctx.session.booking_name!),
    price_label: ctx.session.booking_phone!,
    description: desc,
    photos: [],
  });

  ctx.session.admin_step = undefined;
  ctx.session.admin_service_id = undefined;
  ctx.session.booking_name = undefined;
  ctx.session.booking_phone = undefined;

  await ctx.reply(
    `✅ Service added!\n\n` +
    `Name: ${service.name}\n` +
    `Duration: ${service.duration} min\n` +
    `Price: ${service.price_label}\n` +
    `Description: ${service.description}`,
    {
      reply_markup: inlineKeyboard([
        [inlineButton("➕ Add another", "admin:add_service")],
        [inlineButton("⬅️ Back", "admin:back")],
      ]),
    },
  );
});

composer.callbackQuery("admin:manage_services", async (ctx) => {
  await ctx.answerCallbackQuery();
  const store = getStore();
  const services = await store.getServices();

  if (services.length === 0) {
    await ctx.reply("No services yet.", {
      reply_markup: inlineKeyboard([
        [inlineButton("➕ Add service", "admin:add_service")],
        [inlineButton("⬅️ Back", "admin:back")],
      ]),
    });
    return;
  }

  const rows = services.map((s) => [
    inlineButton(`${s.name} — ${s.price_label}`, `admin:view_service:${s.id}`),
  ]);
  rows.push([inlineButton("⬅️ Back", "admin:back")]);

  await ctx.reply("📋 Your services:", {
    reply_markup: inlineKeyboard(rows),
  });
});

composer.callbackQuery(/^admin:view_service:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const id = ctx.match[1];
  const store = getStore();
  const service = await store.getService(id);
  if (!service) {
    await ctx.reply("Service not found.");
    return;
  }

  await ctx.reply(
    `📌 ${service.name}\n\n` +
    `Duration: ${service.duration} min\n` +
    `Price: ${service.price_label}\n` +
    `Description: ${service.description}`,
    {
      reply_markup: inlineKeyboard([
        [inlineButton("🗑 Delete", `admin:del_service:${service.id}`)],
        [inlineButton("⬅️ Back", "admin:manage_services")],
      ]),
    },
  );
});

composer.callbackQuery(/^admin:del_service:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const id = ctx.match[1];
  const store = getStore();
  await store.deleteService(id);
  await ctx.editMessageText("✅ Service deleted.", {
    reply_markup: inlineKeyboard([[inlineButton("⬅️ Back", "admin:manage_services")]]),
  });
});

composer.callbackQuery("admin:add_portfolio", async (ctx) => {
  await ctx.answerCallbackQuery();
  const store = getStore();
  const services = await store.getServices();
  if (services.length === 0) {
    await ctx.reply("Add a service first before uploading portfolio items.", {
      reply_markup: inlineKeyboard([
        [inlineButton("➕ Add service", "admin:add_service")],
        [inlineButton("⬅️ Back", "admin:back")],
      ]),
    });
    return;
  }

  ctx.session.admin_step = "admin_portfolio_tag";
  const rows = services.map((s) => [
    inlineButton(s.name, `admin:set_portfolio_tag:${s.name}`),
  ]);
  rows.push([inlineButton("⬅️ Back", "admin:back")]);

  await ctx.reply("Which service is this portfolio item for?", {
    reply_markup: inlineKeyboard(rows),
  });
});

composer.callbackQuery(/^admin:set_portfolio_tag:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const tag = ctx.match[1];
  ctx.session.admin_portfolio_tag = tag;
  ctx.session.admin_step = "admin_portfolio_caption";

  await ctx.reply("Add a caption for this portfolio item:", {
    reply_markup: { force_reply: true, input_field_placeholder: "Caption" },
  });
});

composer.on("message:text", async (ctx, next) => {
  if (ctx.session.admin_step !== "admin_portfolio_caption") return next();
  const caption = ctx.message.text.trim();
  const store = getStore();
  const item = await store.addPortfolioItem({
    photos: [],
    caption,
    service_tag: ctx.session.admin_portfolio_tag!,
  });

  ctx.session.admin_step = undefined;
  ctx.session.admin_portfolio_tag = undefined;

  await ctx.reply(
    `✅ Portfolio item added!\n\n` +
    `Service: ${item.service_tag}\n` +
    `Caption: ${item.caption}`,
    {
      reply_markup: inlineKeyboard([
        [inlineButton("➕ Add another", "admin:add_portfolio")],
        [inlineButton("⬅️ Back", "admin:back")],
      ]),
    },
  );
});

composer.callbackQuery("admin:manage_portfolio", async (ctx) => {
  await ctx.answerCallbackQuery();
  const store = getStore();
  const items = await store.getPortfolio();

  if (items.length === 0) {
    await ctx.reply("No portfolio items yet.", {
      reply_markup: inlineKeyboard([
        [inlineButton("➕ Add item", "admin:add_portfolio")],
        [inlineButton("⬅️ Back", "admin:back")],
      ]),
    });
    return;
  }

  const rows = items.map((p) => [
    inlineButton(`${p.service_tag}: ${p.caption.slice(0, 20)}`, `admin:view_portfolio:${p.id}`),
  ]);
  rows.push([inlineButton("⬅️ Back", "admin:back")]);

  await ctx.reply("🖼️ Portfolio items:", {
    reply_markup: inlineKeyboard(rows),
  });
});

composer.callbackQuery(/^admin:view_portfolio:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const id = ctx.match[1];
  const store = getStore();
  const items = await store.getPortfolio();
  const item = items.find((p) => p.id === id);
  if (!item) {
    await ctx.reply("Item not found.");
    return;
  }

  await ctx.reply(
    `🖼️ Portfolio item\n\n` +
    `Service: ${item.service_tag}\n` +
    `Caption: ${item.caption}`,
    {
      reply_markup: inlineKeyboard([
        [inlineButton("🗑 Delete", `admin:del_portfolio:${item.id}`)],
        [inlineButton("⬅️ Back", "admin:manage_portfolio")],
      ]),
    },
  );
});

composer.callbackQuery(/^admin:del_portfolio:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const id = ctx.match[1];
  const store = getStore();
  await store.deletePortfolioItem(id);
  await ctx.editMessageText("✅ Portfolio item deleted.", {
    reply_markup: inlineKeyboard([[inlineButton("⬅️ Back", "admin:manage_portfolio")]]),
  });
});

composer.callbackQuery("admin:respond_reviews", async (ctx) => {
  await ctx.answerCallbackQuery();
  const store = getStore();
  const reviews = await store.getReviews();
  const unanswered = reviews.filter((r) => !r.admin_response);

  if (unanswered.length === 0) {
    await ctx.reply("No reviews waiting for a response.", {
      reply_markup: inlineKeyboard([[inlineButton("⬅️ Back", "admin:back")]]),
    });
    return;
  }

  const rows = unanswered.map((r) => {
    const stars = "⭐".repeat(r.rating);
    return [inlineButton(`${stars} — ${r.text.slice(0, 25)}`, `admin:reply_review:${r.id}`)];
  });
  rows.push([inlineButton("⬅️ Back", "admin:back")]);

  await ctx.reply("⭐ Reviews to respond to:", {
    reply_markup: inlineKeyboard(rows),
  });
});

composer.callbackQuery(/^admin:reply_review:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const id = ctx.match[1];
  ctx.session.admin_review_id = id;
  ctx.session.admin_step = "admin_review_response";

  const store = getStore();
  const review = await store.getReview(id);
  if (!review) {
    await ctx.reply("Review not found.");
    return;
  }

  const stars = "⭐".repeat(review.rating);
  await ctx.reply(
    `Review:\n${stars}\n${review.text}\n\n` +
    `Type your response:`,
    { reply_markup: { force_reply: true, input_field_placeholder: "Your response…" } },
  );
});

composer.on("message:text", async (ctx, next) => {
  if (ctx.session.admin_step !== "admin_review_response") return next();
  const response = ctx.message.text.trim();
  const store = getStore();
  await store.respondToReview(ctx.session.admin_review_id!, response);

  const review = await store.getReview(ctx.session.admin_review_id!);
  ctx.session.admin_step = undefined;
  ctx.session.admin_review_id = undefined;

  await ctx.reply("✅ Response saved.", {
    reply_markup: inlineKeyboard([
      [inlineButton("⬅️ Back to reviews", "admin:respond_reviews")],
      [inlineButton("⬅️ Back", "admin:back")],
    ]),
  });

  if (review) {
    try {
      await ctx.api.sendMessage(
        review.user_id,
        `💬 Admin responded to your review:\n\n"${response}"`,
      );
    } catch {
      // User might not have started the bot
    }
  }
});

composer.callbackQuery("admin:back", async (ctx) => {
  await ctx.answerCallbackQuery();
  ctx.session.admin_step = undefined;
  ctx.session.admin_service_id = undefined;
  ctx.session.admin_portfolio_tag = undefined;
  ctx.session.admin_review_id = undefined;

  await ctx.editMessageText("⚙️ Admin panel", {
    reply_markup: inlineKeyboard([
      [inlineButton("➕ Add service", "admin:add_service")],
      [inlineButton("📋 Manage services", "admin:manage_services")],
      [inlineButton("🖼️ Add portfolio item", "admin:add_portfolio")],
      [inlineButton("📋 Manage portfolio", "admin:manage_portfolio")],
      [inlineButton("⭐ Respond to reviews", "admin:respond_reviews")],
      [inlineButton("⬅️ Back to menu", "menu:main")],
    ]),
  });
});

export default composer;
