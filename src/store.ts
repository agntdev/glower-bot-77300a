import type { StorageAdapter } from "grammy";
import { MemorySessionStorage } from "./toolkit/index.js";

export interface Service {
  id: string;
  name: string;
  duration: number;
  price_label: string;
  description: string;
  photos: string[];
}

export interface PortfolioItem {
  id: string;
  photos: string[];
  caption: string;
  service_tag: string;
}

export interface Review {
  id: string;
  user_id: number;
  text: string;
  photos: string[];
  rating: number;
  admin_response?: string;
  created_at: number;
}

export interface Booking {
  id: string;
  user_id: number;
  client_name: string;
  phone: string;
  service_id: string;
  date: string;
  slot: string;
  status: "confirmed" | "cancelled" | "completed" | "no_show";
  created_at: number;
}

export interface StoreData {
  services: Service[];
  portfolio: PortfolioItem[];
  reviews: Review[];
  bookings: Booking[];
  admin_chat_id?: number;
  business_hours: { start: number; end: number };
}

let idCounter = 0;
function generateId(): string {
  return String(++idCounter);
}

class Store {
  private storage: StorageAdapter<StoreData>;
  private key = "gloweR_store";

  constructor(storage: StorageAdapter<StoreData>) {
    this.storage = storage;
  }

  private async getData(): Promise<StoreData> {
    const data = await this.storage.read(this.key);
    if (data) return data;
    const initial: StoreData = {
      services: [],
      portfolio: [],
      reviews: [],
      bookings: [],
      business_hours: { start: 9, end: 18 },
    };
    await this.storage.write(this.key, initial);
    return initial;
  }

  async getServices(): Promise<Service[]> {
    const data = await this.getData();
    return data.services;
  }

  async getService(id: string): Promise<Service | undefined> {
    const data = await this.getData();
    return data.services.find((s) => s.id === id);
  }

  async addService(s: Omit<Service, "id">): Promise<Service> {
    const data = await this.getData();
    const service: Service = { ...s, id: generateId() };
    data.services.push(service);
    await this.storage.write(this.key, data);
    return service;
  }

  async updateService(id: string, updates: Partial<Service>): Promise<boolean> {
    const data = await this.getData();
    const idx = data.services.findIndex((s) => s.id === id);
    if (idx < 0) return false;
    data.services[idx] = { ...data.services[idx], ...updates, id };
    await this.storage.write(this.key, data);
    return true;
  }

  async deleteService(id: string): Promise<boolean> {
    const data = await this.getData();
    const before = data.services.length;
    data.services = data.services.filter((s) => s.id !== id);
    if (data.services.length === before) return false;
    await this.storage.write(this.key, data);
    return true;
  }

  async getPortfolio(): Promise<PortfolioItem[]> {
    const data = await this.getData();
    return data.portfolio;
  }

  async getPortfolioByService(serviceTag: string): Promise<PortfolioItem[]> {
    const data = await this.getData();
    return data.portfolio.filter((p) => p.service_tag === serviceTag);
  }

  async addPortfolioItem(item: Omit<PortfolioItem, "id">): Promise<PortfolioItem> {
    const data = await this.getData();
    const portfolioItem: PortfolioItem = { ...item, id: generateId() };
    data.portfolio.push(portfolioItem);
    await this.storage.write(this.key, data);
    return portfolioItem;
  }

  async deletePortfolioItem(id: string): Promise<boolean> {
    const data = await this.getData();
    const before = data.portfolio.length;
    data.portfolio = data.portfolio.filter((p) => p.id !== id);
    if (data.portfolio.length === before) return false;
    await this.storage.write(this.key, data);
    return true;
  }

  async getReviews(): Promise<Review[]> {
    const data = await this.getData();
    return data.reviews;
  }

  async getReview(id: string): Promise<Review | undefined> {
    const data = await this.getData();
    return data.reviews.find((r) => r.id === id);
  }

  async addReview(r: Omit<Review, "id" | "created_at">): Promise<Review> {
    const data = await this.getData();
    const review: Review = { ...r, id: generateId(), created_at: Date.now() };
    data.reviews.push(review);
    await this.storage.write(this.key, data);
    return review;
  }

  async respondToReview(id: string, response: string): Promise<boolean> {
    const data = await this.getData();
    const idx = data.reviews.findIndex((r) => r.id === id);
    if (idx < 0) return false;
    data.reviews[idx].admin_response = response;
    await this.storage.write(this.key, data);
    return true;
  }

  async getBookings(): Promise<Booking[]> {
    const data = await this.getData();
    return data.bookings;
  }

  async getBookingsByUser(userId: number): Promise<Booking[]> {
    const data = await this.getData();
    return data.bookings.filter((b) => b.user_id === userId);
  }

  async getBookingsByDate(date: string): Promise<Booking[]> {
    const data = await this.getData();
    return data.bookings.filter((b) => b.date === date && b.status === "confirmed");
  }

  async addBooking(b: Omit<Booking, "id" | "created_at">): Promise<Booking> {
    const data = await this.getData();
    const booking: Booking = { ...b, id: generateId(), created_at: Date.now() };
    data.bookings.push(booking);
    await this.storage.write(this.key, data);
    return booking;
  }

  async updateBooking(id: string, updates: Partial<Booking>): Promise<boolean> {
    const data = await this.getData();
    const idx = data.bookings.findIndex((b) => b.id === id);
    if (idx < 0) return false;
    data.bookings[idx] = { ...data.bookings[idx], ...updates, id };
    await this.storage.write(this.key, data);
    return true;
  }

  async getAdminChatId(): Promise<number | undefined> {
    const data = await this.getData();
    return data.admin_chat_id;
  }

  async setAdminChatId(chatId: number): Promise<void> {
    const data = await this.getData();
    data.admin_chat_id = chatId;
    await this.storage.write(this.key, data);
  }

  async getBusinessHours(): Promise<{ start: number; end: number }> {
    const data = await this.getData();
    return data.business_hours;
  }
}

let globalStore: Store | null = null;

export function getStore(): Store {
  if (!globalStore) {
    globalStore = new Store(new MemorySessionStorage<StoreData>());
  }
  return globalStore;
}

export function resetStore(): void {
  globalStore = null;
  idCounter = 0;
}
