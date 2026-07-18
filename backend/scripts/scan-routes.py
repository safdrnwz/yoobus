#!/usr/bin/env python3
"""
Regenerate test/routes.json — the backend's own route inventory.

Captures, per route: method, path, roles, @Public, @RequirePermission, and — crucially —
the @Body() and @Query() DTO class names. Those DTO names are what let the frontend be
typed against the real contract instead of `Record<string, unknown>`.

Run this whenever a controller changes:  npm run routes:scan
"""
import re, os, json


def args_of(src: str, open_paren: int) -> str:
    """Read a parameter list with balanced parens — `@Body() dto: X` contains a `)`."""
    depth, i = 0, open_paren
    while i < len(src):
        if src[i] == '(':
            depth += 1
        elif src[i] == ')':
            depth -= 1
            if depth == 0:
                return src[open_paren + 1:i]
        i += 1
    return ''


rows = []
for root, _, files in os.walk('src'):
    for f in files:
        if not f.endswith('.controller.ts'):
            continue
        p = os.path.join(root, f)
        s = open(p).read()
        mc = re.search(r"@Controller\(\s*['\"]?([^'\")]*)['\"]?\s*\)", s)
        base = (mc.group(1) if mc else '').strip()
        head = s[:mc.start()] if mc else ''
        cls_roles = re.findall(r"@Roles\(([^)]*)\)", head)
        cls_public = '@Public()' in head
        body = s[mc.start():] if mc else s

        for mm in re.finditer(
            r"((?:@\w+\([^)]*\)\s*)*)@(Get|Post|Put|Patch|Delete)"
            r"\(\s*['\"]?([^'\")]*)['\"]?\s*\)\s*(?:async\s+)?(\w+)\s*\(", body, re.S
        ):
            decs, verb, path, fn = mm.groups()
            args = args_of(body, mm.end() - 1)
            rr = re.findall(r"@Roles\(([^)]*)\)", decs)
            roles = re.findall(r"Role\.(\w+)", rr[0]) if rr else (
                re.findall(r"Role\.(\w+)", cls_roles[0]) if cls_roles else [])
            body_dto = re.findall(r"@Body\(\)\s*\w+\s*:\s*(\w+)", args)
            query_dto = re.findall(r"@Query\(\)\s*\w+\s*:\s*(\w+)", args)
            full = '/' + re.sub(r'/+', '/', base.strip('/') + ('/' + path.strip('/') if path.strip('/') else ''))
            rows.append({
                'm': verb.upper(),
                'p': full.replace('//', '/'),
                'fn': fn,
                'roles': roles,
                'public': '@Public()' in decs or cls_public,
                'perm': re.findall(r"@RequirePermission\('([A-Z_0-9]+)'", decs),
                'bodyDto': body_dto[0] if body_dto else None,
                'queryDto': query_dto[0] if query_dto else None,
                'queryKeys': re.findall(r"@Query\(\s*['\"](\w+)['\"]", args),
                'file': p,
            })

json.dump(rows, open('test/routes.json', 'w'), indent=0)
print(f"{len(rows)} routes -> test/routes.json")
print(f"  public: {sum(1 for r in rows if r['public'])}")
print(f"  role-guarded: {sum(1 for r in rows if r['roles'])}")
print(f"  with a @Body DTO: {sum(1 for r in rows if r['bodyDto'])}")
print(f"  with a @Query DTO: {sum(1 for r in rows if r['queryDto'])}")
