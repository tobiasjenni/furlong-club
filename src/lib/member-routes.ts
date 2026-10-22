// Public trading/plans pages stay separate from the signed-in workspace.
export const memberPaths = ["/dashboard", "/account", "/wallet", "/allocations", "/performance", "/activity", "/planner", "/membership", "/deposits", "/support"];
export function isMemberPath(path: string) {
  return memberPaths.some(root => path === root || path.startsWith(root + "/"));
}
