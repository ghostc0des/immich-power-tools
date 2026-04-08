import { registerProcessor } from "../registry";
import { ImmichSharedLinkProcessor } from "./immich-shared-link";
import { NextcloudSharedLinkProcessor } from "./nextcloud-shared-link";

registerProcessor("immich", new ImmichSharedLinkProcessor());
registerProcessor("nextcloud", new NextcloudSharedLinkProcessor());
