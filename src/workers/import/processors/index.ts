import { registerProcessor } from "../registry";
import { ImmichSharedLinkProcessor } from "./immich-shared-link";

registerProcessor("immich", new ImmichSharedLinkProcessor());
