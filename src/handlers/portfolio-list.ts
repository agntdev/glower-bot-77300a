import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { getStore } from "../store.js";

const composer = new Composer<Ctx>();

composer.callbackQuery("portfolio:list", async (ctx) => {
  await ctx.answerCallbackQuery();
  ctx.session.step = "portfolio";

  const store = getStore();
  const services = await store.getServices();
  const portfolio = await store.getPortfolio();

  if (portfolio.length === 0) {
    await ctx.reply("No portfolio items yet — check back soon!", {
      reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]),
    });
    return;
  }

  const rows: ReturnType<typeof inlineButton>[][] = [];
  rows.push([inlineButton("All", "portfolio:filter:all")]);
  for (const s of services) {
    const hasItems = portfolio.some((p) => p.service_tag === s.name);
    if (hasItems) {
      rows.push([inlineButton(s.name, `portfolio:filter:${s.name}`)]);
    }
  }
  rows.push([inlineButton("⬅️ Back to menu", "menu:main")]);

  await ctx.reply("🖼️ Browse our work — pick a category:", {
    reply_markup: inlineKeyboard(rows),
  });
});

composer.callbackQuery(/^portfolio:filter:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const filter = ctx.match[1];

  const store = getStore();
  const items = filter === "all" ? await store.getPortfolio() : await store.getPortfolioByService(filter);

  if (items.length === 0) {
    await ctx.reply("No items in this category yet.", {
      reply_markup: inlineKeyboard([
        [inlineButton("⬅️ Back to categories", "portfolio:list")],
      ]),
    });
    return;
  }

  for (const item of items.slice(0, 10)) {
    const caption = item.caption || `Portfolio — ${item.service_tag}`;
    if (item.photos.length > 0) {
      try {
        await ctx.replyWithPhoto(item.photos[0], { caption });
      } catch {
        await ctx.reply(caption);
      }
    } else {
      await ctx.reply(caption);
    }
  }

  await ctx.reply("That's all for now!", {
    reply_markup: inlineKeyboard([
      [inlineButton("⬅️ Back to categories", "portfolio:list")],
      [inlineButton("⬅️ Back to menu", "menu:main")],
    ]),
  });
});

export default composer;
