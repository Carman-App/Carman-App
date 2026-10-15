import { Redirect } from "expo-router";

/** The tab button opens the listing wizard; this route only exists for deep links. */
export default function Add() {
  return <Redirect href="/listing/new" />;
}
