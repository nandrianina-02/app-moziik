import { connectDB } from "@/lib/db";
import HomepageSettingsModel from "@/models/HomepageSettings";

const HOMEPAGE_SETTINGS_ID = "000000000000000000000002";

/** Lit les réglages de la homepage en base ; crée le document par défaut au premier appel. */
export async function getHomepageSettings() {
  await connectDB();
  let settings = await HomepageSettingsModel.findById(HOMEPAGE_SETTINGS_ID);

  if (!settings) {
    settings = await HomepageSettingsModel.create({ _id: HOMEPAGE_SETTINGS_ID });
  }

  return settings;
}
