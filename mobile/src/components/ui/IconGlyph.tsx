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
import TireIcon from '@hugeicons/core-free-icons/TireIcon';
import ToolsIcon from '@hugeicons/core-free-icons/ToolsIcon';
import TowTruckIcon from '@hugeicons/core-free-icons/TowTruckIcon';
import UserGroupIcon from '@hugeicons/core-free-icons/UserGroupIcon';
import Wrench01Icon from '@hugeicons/core-free-icons/Wrench01Icon';

import { Colors, Radius } from '@/theme/tokens';

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
};

type IconGlyphProps = {
  glyph: keyof typeof ICONS | string;
  size?: number;
  bg?: string;
  fg?: string;
};

export function IconGlyph({ glyph, size = 40, bg = Colors.surfaceMuted, fg }: IconGlyphProps) {
  const icon = ICONS[glyph];
  return (
    <View style={[styles.base, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }]}>
      {icon ? <HugeiconsIcon icon={icon} size={size * 0.5} color={fg ?? Colors.text} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.pill,
  },
});
