import { StyleSheet, View } from 'react-native';
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react-native';

// Deep, per-icon imports (rather than `import { X } from '@hugeicons/core-free-icons'`)
// on purpose: the package's barrel `index.js` statically re-exports all 6,000+ free
// icons, and Metro has to open every one of those files to build the module graph
// even though only a handful end up in the bundle. On this machine that blew past the
// OS file-descriptor limit (`EMFILE: too many open files`) and broke the dev server.
// Importing each icon from its own subpath (enabled by the package's `"./*"` exports
// map entry) sidesteps the barrel file entirely, so only the icons actually used here
// are ever opened/bundled -- true tree-shaking instead of relying on the bundler to
// prune the barrel's re-exports.
import Add01Icon from '@hugeicons/core-free-icons/Add01Icon';
import ArrowDown01Icon from '@hugeicons/core-free-icons/ArrowDown01Icon';
import ArrowLeft02Icon from '@hugeicons/core-free-icons/ArrowLeft02Icon';
import ArrowRight01Icon from '@hugeicons/core-free-icons/ArrowRight01Icon';
import ArrowUp01Icon from '@hugeicons/core-free-icons/ArrowUp01Icon';
import ArrowUpRight01Icon from '@hugeicons/core-free-icons/ArrowUpRight01Icon';
import Cancel01Icon from '@hugeicons/core-free-icons/Cancel01Icon';
import Chat01Icon from '@hugeicons/core-free-icons/Chat01Icon';
import CheckmarkCircle02Icon from '@hugeicons/core-free-icons/CheckmarkCircle02Icon';
import CloudUploadIcon from '@hugeicons/core-free-icons/CloudUploadIcon';
import Delete02Icon from '@hugeicons/core-free-icons/Delete02Icon';
import GarageIcon from '@hugeicons/core-free-icons/GarageIcon';
import Home02Icon from '@hugeicons/core-free-icons/Home02Icon';
import Image01Icon from '@hugeicons/core-free-icons/Image01Icon';
import InformationCircleIcon from '@hugeicons/core-free-icons/InformationCircleIcon';
import Logout01Icon from '@hugeicons/core-free-icons/Logout01Icon';
import Mail01Icon from '@hugeicons/core-free-icons/Mail01Icon';
import Menu01Icon from '@hugeicons/core-free-icons/Menu01Icon';
import Mic01Icon from '@hugeicons/core-free-icons/Mic01Icon';
import PencilEdit01Icon from '@hugeicons/core-free-icons/PencilEdit01Icon';
import PieChart08Icon from '@hugeicons/core-free-icons/PieChart08Icon';
import PrinterIcon from '@hugeicons/core-free-icons/PrinterIcon';
import RefreshDotIcon from '@hugeicons/core-free-icons/RefreshDotIcon';
import Search01Icon from '@hugeicons/core-free-icons/Search01Icon';
import Settings01Icon from '@hugeicons/core-free-icons/Settings01Icon';
import Share01Icon from '@hugeicons/core-free-icons/Share01Icon';
import StopIcon from '@hugeicons/core-free-icons/StopIcon';
import Upload01Icon from '@hugeicons/core-free-icons/Upload01Icon';
import UserAdd01Icon from '@hugeicons/core-free-icons/UserAdd01Icon';
import UserMultipleIcon from '@hugeicons/core-free-icons/UserMultipleIcon';
import UserSwitchIcon from '@hugeicons/core-free-icons/UserSwitchIcon';
import WifiOff01Icon from '@hugeicons/core-free-icons/WifiOff01Icon';
import Alert02Icon from '@hugeicons/core-free-icons/Alert02Icon';
import Analytics01Icon from '@hugeicons/core-free-icons/Analytics01Icon';
import ArrowReloadHorizontalIcon from '@hugeicons/core-free-icons/ArrowReloadHorizontalIcon';
import BankIcon from '@hugeicons/core-free-icons/BankIcon';
import Calendar01Icon from '@hugeicons/core-free-icons/Calendar01Icon';
import Camera01Icon from '@hugeicons/core-free-icons/Camera01Icon';
import Car01Icon from '@hugeicons/core-free-icons/Car01Icon';
import CarParking01Icon from '@hugeicons/core-free-icons/CarParking01Icon';
import CheckmarkBadge01Icon from '@hugeicons/core-free-icons/CheckmarkBadge01Icon';
import CleanIcon from '@hugeicons/core-free-icons/CleanIcon';
import Clock01Icon from '@hugeicons/core-free-icons/Clock01Icon';
import CreditCardIcon from '@hugeicons/core-free-icons/CreditCardIcon';
import CubeIcon from '@hugeicons/core-free-icons/CubeIcon';
import DashboardSpeed01Icon from '@hugeicons/core-free-icons/DashboardSpeed01Icon';
import File01Icon from '@hugeicons/core-free-icons/File01Icon';
import FuelStationIcon from '@hugeicons/core-free-icons/FuelStationIcon';
import Home01Icon from '@hugeicons/core-free-icons/Home01Icon';
import Invoice01Icon from '@hugeicons/core-free-icons/Invoice01Icon';
import JusticeScale01Icon from '@hugeicons/core-free-icons/JusticeScale01Icon';
import LicenseIcon from '@hugeicons/core-free-icons/LicenseIcon';
import Location01Icon from '@hugeicons/core-free-icons/Location01Icon';
import Motorbike01Icon from '@hugeicons/core-free-icons/Motorbike01Icon';
import Note01Icon from '@hugeicons/core-free-icons/Note01Icon';
import Notification01Icon from '@hugeicons/core-free-icons/Notification01Icon';
import PoliceBadgeIcon from '@hugeicons/core-free-icons/PoliceBadgeIcon';
import QrCodeIcon from '@hugeicons/core-free-icons/QrCodeIcon';
import RepeatIcon from '@hugeicons/core-free-icons/RepeatIcon';
import Settings02Icon from '@hugeicons/core-free-icons/Settings02Icon';
import Shield01Icon from '@hugeicons/core-free-icons/Shield01Icon';
import ShoppingBag01Icon from '@hugeicons/core-free-icons/ShoppingBag01Icon';
import Tick02Icon from '@hugeicons/core-free-icons/Tick02Icon';
import GoogleIcon from '@hugeicons/core-free-icons/GoogleIcon';
import TireIcon from '@hugeicons/core-free-icons/TireIcon';
import ToolsIcon from '@hugeicons/core-free-icons/ToolsIcon';
import TowTruckIcon from '@hugeicons/core-free-icons/TowTruckIcon';
import UserGroupIcon from '@hugeicons/core-free-icons/UserGroupIcon';
import Wrench01Icon from '@hugeicons/core-free-icons/Wrench01Icon';

import { Colors } from '@/theme/tokens';

// Real Hugeicons (free, stroke-rounded set) replacing the earlier emoji
// placeholders, matched 1:1 against the Carma prototype's `hgi-*` classes
// (see the ICONS / ICON_FOR maps in the prototype source). The free tier
// only ships the stroke-rounded style -- there's no solid variant to swap
// in for selected states, so every glyph renders the same stroke icon
// everywhere (the prototype's `hgi-solid` selected state isn't available
// without the paid Hugeicons Pro packages).
const ICONS: Record<string, IconSvgElement> = {
  fuel: FuelStationIcon,
  service: Wrench01Icon,
  repair: ToolsIcon,
  part: TireIcon,
  expense: CreditCardIcon,
  odometer: DashboardSpeed01Icon,
  insurance: Shield01Icon,
  loan: BankIcon,
  document: File01Icon,
  reminder: Notification01Icon,
  garage: Home01Icon,
  vehicle: Car01Icon,
  motorcycle: Motorbike01Icon,
  timeline: Clock01Icon,
  insights: Analytics01Icon,
  build: CubeIcon,
  invoice: Invoice01Icon,
  estimate: File01Icon,
  inspection: CheckmarkBadge01Icon,
  qr: QrCodeIcon,
  member: UserGroupIcon,
  camera: Camera01Icon,
  scan: Camera01Icon,
  place: Location01Icon,
  date: Calendar01Icon,
  soon: Clock01Icon,
  check: Tick02Icon,
  google: GoogleIcon,
  warning: Alert02Icon,
  wallet: CreditCardIcon,
  transfer: ArrowReloadHorizontalIcon,

  // Expense sub-categories used by `/record/add`'s category list -- these
  // map 1:1 to the prototype's ICON_FOR keys (Licence & fees, Parking &
  // tolls, Car wash & cleaning, Accessories, Security, Roadside & recovery,
  // Fines & penalties, Subscriptions, Modifications, Something else).
  licence: LicenseIcon,
  parking: CarParking01Icon,
  carwash: CleanIcon,
  accessories: ShoppingBag01Icon,
  security: PoliceBadgeIcon,
  roadside: TowTruckIcon,
  fines: JusticeScale01Icon,
  subscriptions: RepeatIcon,
  modifications: Settings02Icon,
  other: Note01Icon,

  // Chrome and actions used by the redesigned screens.
  add: Add01Icon,
  back: ArrowLeft02Icon,
  'chevron-down': ArrowDown01Icon,
  'chevron-right': ArrowRight01Icon,
  send: ArrowUp01Icon,
  open: ArrowUpRight01Icon,
  close: Cancel01Icon,
  chat: Chat01Icon,
  done: CheckmarkCircle02Icon,
  upload: CloudUploadIcon,
  'upload-file': Upload01Icon,
  delete: Delete02Icon,
  'garage-door': GarageIcon,
  home: Home02Icon,
  image: Image01Icon,
  info: InformationCircleIcon,
  logout: Logout01Icon,
  mail: Mail01Icon,
  menu: Menu01Icon,
  mic: Mic01Icon,
  edit: PencilEdit01Icon,
  pie: PieChart08Icon,
  print: PrinterIcon,
  swap: RefreshDotIcon,
  search: Search01Icon,
  settings: Settings01Icon,
  share: Share01Icon,
  stop: StopIcon,
  'user-add': UserAdd01Icon,
  members: UserMultipleIcon,
  'switch-profile': UserSwitchIcon,
  offline: WifiOff01Icon,
};

type IconGlyphProps = {
  glyph: keyof typeof ICONS | string;
  size?: number;
  bg?: string;
  fg?: string;
  /** Glyph size as a fraction of the tile. */
  scale?: number;
  /** 'circle' (default) or the design's soft rounded 'tile' (10px radius). */
  shape?: 'circle' | 'tile';
};

export function IconGlyph({ glyph, size = 40, bg = Colors.accentSoft, fg, scale = 0.5, shape = 'circle' }: IconGlyphProps) {
  const icon = ICONS[glyph];
  const radius = shape === 'tile' ? Math.round(size * 0.3) : size / 2;
  return (
    <View style={[styles.base, { width: size, height: size, borderRadius: radius, backgroundColor: bg }]}>
      {icon ? <HugeiconsIcon icon={icon} size={Math.round(size * scale)} color={fg ?? Colors.accent} strokeWidth={1.6} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
