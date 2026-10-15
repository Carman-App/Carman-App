import type { BodyType, Condition, DriveType, FuelType, ImportStatus, Transmission, VehicleStatus } from "../constants/vehicles";
import type { InquiryStatus, InquiryType, ReportReason, ReportStatus } from "../schemas/engagement";
import type { VerificationStatus } from "../schemas/profiles";
import type { BoostStatus, BoostType, PaymentPurpose, PaymentStatus, PlanFeatureKey, SubscriptionStatus } from "../schemas/billing";

export interface VehicleImage {
  url: string;
  publicId: string;
  width?: number;
  height?: number;
}

export interface VehicleVideo {
  url: string;
  publicId: string;
  posterUrl?: string;
  durationSec?: number;
}

export interface SellerSummary {
  type: "BROKER" | "DEALER";
  id: string;
  slug: string;
  name: string;
  phone?: string;
  whatsappNumber?: string;
  town?: string;
  logoUrl?: string;
  isVerified: boolean;
  ratingAvg: number;
  ratingCount: number;
  memberSince: string;
}

export interface Vehicle {
  id: string;
  slug: string;
  title: string;
  sellerId: string;
  dealerId?: string;
  make: string;
  model: string;
  year: number;
  price: number;
  priceNegotiable: boolean;
  mileage: number;
  fuelType: FuelType;
  transmission: Transmission;
  engineCapacity: number;
  bodyType: BodyType;
  driveType: DriveType;
  color: string;
  condition: Condition;
  importStatus: ImportStatus;
  location: { town: string; county?: string; area?: string };
  description: string;
  features: string[];
  images: VehicleImage[];
  videos: VehicleVideo[];
  status: VehicleStatus;
  isFeatured: boolean;
  isBoosted: boolean;
  isVerified: boolean;
  publishedAt?: string;
  soldAt?: string;
  createdAt: string;
  updatedAt: string;
  seller?: SellerSummary;
  /** Owner/admin only. */
  stats?: { views: number; whatsappClicks: number; callClicks: number; inquiries: number; favorites: number };
  rejectionReason?: string;
  moderationHistory?: { action: string; reason?: string; at: string }[];
  isFavorite?: boolean;
}

export interface BrokerProfile {
  id: string;
  userId: string;
  slug: string;
  displayName: string;
  bio?: string;
  phone?: string;
  whatsappNumber?: string;
  town?: string;
  yearsInBusiness?: number;
  specialties: string[];
  logo?: { url: string; publicId?: string };
  cover?: { url: string; publicId?: string };
  facebookUrl?: string;
  instagramUrl?: string;
  tiktokUrl?: string;
  verificationStatus: VerificationStatus;
  verifiedAt?: string;
  ratingAvg: number;
  ratingCount: number;
  followerCount: number;
  activeListingCount: number;
  createdAt: string;
  isFollowing?: boolean;
}

export interface DealerProfile extends Omit<BrokerProfile, "displayName" | "bio" | "yearsInBusiness" | "specialties" | "facebookUrl" | "instagramUrl" | "tiktokUrl"> {
  businessName: string;
  description?: string;
  email?: string;
  address?: string;
  openingHours?: string;
  website?: string;
  ownerId: string;
}

export interface DealerStaffMember {
  userId: string;
  name: string;
  email: string;
  phone?: string;
  staffRole: "MANAGER" | "SALES";
  addedAt: string;
}

export interface Inquiry {
  id: string;
  vehicleId: string;
  vehicle?: Pick<Vehicle, "id" | "slug" | "title" | "price" | "images" | "status">;
  buyer?: { id: string; name: string; phone?: string; email?: string };
  type: InquiryType;
  status: InquiryStatus;
  message: string;
  phone?: string;
  preferredDate?: string;
  sellerNote?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Review {
  id: string;
  rating: number;
  comment: string;
  buyer: { name: string };
  createdAt: string;
}

export interface Report {
  id: string;
  vehicleId: string;
  reason: ReportReason;
  details: string;
  status: ReportStatus;
  resolution?: string;
  createdAt: string;
}

export interface Plan {
  id: string;
  code: string;
  name: string;
  description: string;
  audience: "BROKER" | "DEALER" | "ALL";
  priceKes: number;
  periodDays: number;
  listingLimit: number;
  staffLimit: number;
  features: Record<PlanFeatureKey, boolean>;
  highlights: string[];
  isActive: boolean;
  sortOrder: number;
}

export interface Entitlements {
  planCode: string;
  planName: string;
  listingLimit: number;
  staffLimit: number;
  activeListings: number;
  features: Record<PlanFeatureKey, boolean>;
  subscriptionEndsAt?: string;
}

export interface Subscription {
  id: string;
  planCode: string;
  planName: string;
  status: SubscriptionStatus;
  priceKes: number;
  startsAt?: string;
  endsAt?: string;
  createdAt: string;
}

export interface Payment {
  id: string;
  purpose: PaymentPurpose;
  amountKes: number;
  status: PaymentStatus;
  phone: string;
  description: string;
  mpesaReceiptNumber?: string;
  failureReason?: string;
  createdAt: string;
  completedAt?: string;
}

export interface Boost {
  id: string;
  vehicleId: string;
  type: BoostType;
  packageCode: string;
  days: number;
  priceKes: number;
  status: BoostStatus;
  startsAt?: string;
  endsAt?: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  readAt?: string;
  createdAt: string;
}

export interface Category {
  id: string;
  kind: "MAKE" | "BODY_TYPE";
  name: string;
  slug: string;
  models: string[];
  bodyType?: BodyType;
  isActive: boolean;
  isPopular: boolean;
  sortOrder: number;
  vehicleCount?: number;
}

export interface SellerAnalytics {
  range: { days: number; from: string; to: string };
  totals: { views: number; whatsappClicks: number; callClicks: number; viewingRequests: number; questions: number; favorites: number };
  listings: Record<VehicleStatus, number>;
  advanced: boolean;
  series?: { date: string; views: number; whatsappClicks: number; callClicks: number; inquiries: number }[];
  perVehicle?: { id: string; title: string; slug: string; status: VehicleStatus; views: number; whatsappClicks: number; callClicks: number; inquiries: number }[];
}

export interface AdminOverview {
  totals: {
    users: number;
    buyers: number;
    brokers: number;
    dealers: number;
    activeListings: number;
    pendingListings: number;
    soldVehicles: number;
    inquiries: number;
    openReports: number;
    pendingVerifications: number;
    revenueThisMonthKes: number;
  };
  series: { date: string; listings: number; registrations: number; views: number; inquiries: number; revenueKes: number }[];
}
