import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { getStore } from "../store.js";

const composer = new Composer<Ctx>();

composer.callbackQuery("reviews:submit", async (ctx) => {
  await ctx.answerCallbackQuery();
  ctx.session.step = "review_rating";

  await ctx.reply("How would you rate your experience?\n\nTap a star to rate:", {
    reply_markup: inlineKeyboard([
      [
        inlineButton("⭐", "review:rate:1"),
        inlineButton("⭐⭐", "review:rate:2"),
        inlineButton("⭐⭐⭐", "review:rate:3"),
      ],
      [
        inlineButton("⭐⭐⭐⭐", "review:rate:4"),
        inlineButton("⭐⭐⭐⭐⭐", "review:rate:5"),
      ],
    ]),
  });
});

composer.callbackQuery(/^review:rate:(\d)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const rating = parseInt(ctx.match[1]);
  ctx.session.review_rating = rating;
  ctx.session.step = "review_text";

  await ctx.reply("Thanks! Tell us about your experience.", {
    reply_markup: { force_reply: true, input_field_placeholder: "Type your review…" },
  });
});

composer.on("message:text", async (ctx, next) => {
  if (ctx.session.step !== "review_text") return next();
  const text = ctx.message.text.trim();
  if (text.length < 3) {
    await ctx.reply("Your review is too short — tell us a bit more.");
    return;
  }
  ctx.session.review_text = text;
  ctx.session.step = "review_confirm";

  const stars = "⭐".repeat(ctx.session.review_rating!);
  await ctx.reply(
    `📋 Review preview:\n\n` +
    `Rating: ${stars}\n` +
    `Review: ${text}\n\n` +
    `Submit this review?`,
    {
      reply_markup: inlineKeyboard([
        [inlineButton("✅ Submit", "review:submit:yes"), inlineButton("❌ Cancel", "review:submit:no")],
      ]),
    },
  );
});

composer.callbackQuery("review:submit:yes", async (ctx) => {
  await ctx.answerCallbackQuery();
  const store = getStore();
  const review = await store.addReview({
    user_id: ctx.from!.id,
    text: ctx.session.review_text!,
    photos: [],
    rating: ctx.session.review_rating!,
  });

  ctx.session.step = "idle";
  ctx.session.review_rating = undefined;
  ctx.session.review_text = undefined;

  const stars = "⭐".repeat(review.rating);
  await ctx.editMessageText(
    `✅ Review submitted! Thanks for your feedback.\n\n` +
    `Rating: ${stars}\n` +
    `Review: ${review.text}`,
    { reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]) },
  );

  const adminChatId = await store.getAdminChatId();
  if (adminChatId) {
    try {
      await ctx.api.sendMessage(
        adminChatId,
        `⭐ New review!\n\n` +
        `Rating: ${stars}\n` +
        `Review: ${review.text}\n\n` +
        `Reply with /respond ${review.id} <message> to respond.`,
      );
    } catch {
      // Admin chat might not have started the bot
    }
  }
});

composer.callbackQuery("review:submit:no", async (ctx) => {
  await ctx.answerCallbackQuery();
  ctx.session.step = "idle";
  ctx.session.review_rating = undefined;
  ctx.session.review_text = undefined;

  await ctx.editMessageText("Review discarded. Tap /start to begin again.", {
    reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]),
  });
});

export default composer;
