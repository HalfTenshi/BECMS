import { authorize } from "./authorize.js";

export const can = (action, resource) => [authorize(action, resource)];
