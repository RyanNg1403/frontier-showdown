"""Reusable move templates. Each takes the fighter's ready pose `S`, frame-data timing `(startup, active,
recovery)` and options, and returns a `kit.Move` whose `hit` frame is the first active frame.

Sides: "l" = lead (far) hand/foot in the orthodox guard, "r" = rear (near, camera-side).
"""

from _kit import put, seq, timing

# Matches the shared crouch state (shared.CROUCH), so crouching attacks start and end on it.
CROUCH = dict(pz=-0.62, ppitch=9.6, spitch=20.0, syaw=-30.0, npitch=-4.0, hpitch=-10.0,
              lf=(0.30, 0.15, 0.0), rf=(-0.34, 0.184, 0.0), lko=0.3, rko=0.45, rfp=38.0, rtp=0.0)


def crouch(S, **kw):
    c = put(S, **CROUCH)
    c.update(kw)
    return c


def air(S, **kw):
    # Matches the apex of the shared jump_air state.
    a = put(S, pz=0.0, ppitch=4.8, spitch=10.0, lf=(0.24, 0.126, 0.42), rf=(-0.04, 0.16, 0.34),
            lfp=10.0, rfp=20.0, lko=0.25, rko=0.25)
    a.update(kw)
    return a


def recover(r, S, ease="io"):
    """Recovery split into a short hold and an ease back to the ready pose."""
    hold = max(1, r // 3)
    return [(hold, {}, "lin"), (r - hold, S, ease)]


# ---------------------------------------------------------------------------------------------- punches

def jab(S, fd, side="l", target=(0.98, 0.04, -0.06), lean=6.0, extra=None, vfx=None):
    k, a, r = timing(*fd)
    h = side + "h"
    chamber = {h: (0.45, -0.12, -0.02), "syaw": S["syaw"] - 4}
    strike = {h: target, "syaw": S["syaw"] - 14 if side == "l" else S["syaw"] + 30,
              "pyaw": S["pyaw"] - 4 if side == "l" else S["pyaw"] + 18, "spitch": S["spitch"] + lean,
              "px": S["px"] + 0.03}
    strike.update(extra or {})
    marks = ["hit"] + ([f"vfx:{vfx}"] if vfx else [])
    return seq(S, [(k, chamber, "in"), (a, strike, "snap", marks)] + recover(r, S))


def straight(S, fd, side="r", target=(1.0, 0.02, -0.12), step=0.08, extra=None, vfx=None, overhand=False):
    """Rear straight or overhand: hip and shoulder drive, the rear heel lifts, a small step."""
    k, a, r = timing(*fd)
    h = side + "h"
    if overhand:
        chamber = {h: (-0.12, 0.5, 0.22), "syaw": S["syaw"] - 14,
                   "spitch": S["spitch"] - 6, "pz": S["pz"] + 0.01}
        strike = {h: (0.95, -0.05, -0.12), "syaw": S["syaw"] + 46,
                  "pyaw": S["pyaw"] + 26, "spitch": S["spitch"] + 18, "rfp": 30.0, "rtp": 0.0,
                  "px": S["px"] + step, "pz": S["pz"] - 0.03, "lf": (S["lf"][0] + step, S["lf"][1], 0.0)}
    else:
        chamber = {h: (0.3, -0.2, -0.1), "syaw": S["syaw"] - 10, "pyaw": S["pyaw"] - 6}
        strike = {h: target, "syaw": S["syaw"] + 44, "pyaw": S["pyaw"] + 26, "spitch": S["spitch"] + 8,
                  "rfp": 28.0, "rtp": 0.0, "px": S["px"] + step, "lf": (S["lf"][0] + step, S["lf"][1], 0.0),
                  "lh": (0.35, -0.12, -0.1)}
    strike.update(extra or {})
    marks = ["hit"] + ([f"vfx:{vfx}"] if vfx else [])
    return seq(S, [(k, chamber, "in"), (a, strike, "snap", marks)] + recover(r, S))


def uppercut(S, fd, side="r", rise=0.12, airborne=0.0, extra=None, vfx=None, start=None):
    """Dip then rising uppercut; `airborne` lifts both feet (DP-style reversals)."""
    k, a, r = timing(*fd)
    h = side + "h"
    base = start or S
    dip = {h: (0.25, -0.5, -0.05), "pz": base["pz"] - 0.08,
           "spitch": base["spitch"] + 14, "syaw": base["syaw"] - 10}
    up = {h: (0.42, 0.92, -0.12), "pz": S["pz"] + rise + airborne,
          "spitch": -6.0, "syaw": S["syaw"] + 34, "pyaw": S["pyaw"] + 20, "hpitch": -12.0}
    if airborne:
        up.update(lf=(S["lf"][0] - 0.05, S["lf"][1], airborne * 0.9), rf=(S["rf"][0] + 0.2, S["rf"][1], airborne + 0.25),
                  lfp=30.0, rfp=45.0)
    up.update(extra or {})
    marks = ["hit"] + ([f"vfx:{vfx}"] if vfx else [])
    segs = [(k, dip, "in"), (a, up, "snap", marks)]
    if airborne:
        segs += [(max(1, r // 2), {"pz": S["pz"] + airborne * 0.6}, "out"),
                 (r - max(1, r // 2), put(S, pz=S["pz"] - 0.05), "in")]
    else:
        segs += recover(r, S)
    return seq(base, segs)


# ------------------------------------------------------------------------------------------------ kicks

def front_kick(S, fd, side="l", height=0.45, reach=0.85, toe=10.0, extra=None, vfx=None, teep=False):
    """Toe poke / teep with the lead leg; teep pushes with the sole (toes up)."""
    k, a, r = timing(*fd)
    f = side + "f"
    chamber = {f: (S[f][0] * 0.4 + 0.1, S[f][1] * 0.7, height * 0.75), side + "fp": 30.0, "spitch": S["spitch"] - 6,
               "lh": (0.4, -0.05, -0.05), "rh": (0.35, -0.12, -0.15)}
    strike = {f: (reach, S[f][1] * 0.5, height), side + "fp": -45.0 if teep else toe, "spitch": S["spitch"] - 14,
              "ppitch": S["ppitch"] - 10, "px": S["px"] - 0.03}
    strike.update(extra or {})
    marks = ["hit"] + ([f"vfx:{vfx}"] if vfx else [])
    return seq(S, [(k, chamber, "out"), (a, strike, "snap", marks), (max(1, r // 2), chamber, "io"),
                   (r - max(1, r // 2), S, "io")])


def roundhouse(S, fd, side="r", height=0.85, extra=None, vfx=None):
    """Turning kick with the rear leg: pivot on the lead foot, hips turn over, lean back."""
    k, a, r = timing(*fd)
    f = side + "f"
    other = "l" if side == "r" else "r"
    chamber = {f: (0.32, 0.02, 0.7), side + "fp": 50.0, "pyaw": S["pyaw"] + 40, "syaw": S["syaw"] + 10,
               other + "fy": 55.0, "spitch": S["spitch"] - 4, "pz": S["pz"] + 0.02}
    strike = {f: (0.95, -0.06, height), side + "fp": 55.0, "pyaw": S["pyaw"] + 70, "syaw": S["syaw"] + 40,
              "spitch": -10.0, "ppitch": -6.0, other + "fy": 80.0, "lh": (0.3, -0.05, 0.25),
              "rh": (-0.2, -0.3, 0.3), "rko": 0.9}
    strike.update(extra or {})
    marks = ["hit"] + ([f"vfx:{vfx}"] if vfx else [])
    return seq(S, [(k, chamber, "out"), (a, strike, "snap", marks), (max(1, r // 2), chamber, "io"),
                   (r - max(1, r // 2), S, "io")])


def axe_kick(S, fd, side="l", extra=None, vfx=None):
    """High axe kick: straight leg rises above head height, then chops down."""
    k, a, r = timing(*fd)
    f = side + "f"
    raise_ = {f: (0.42, 0.06, 1.95), side + "fp": 10.0, side + "ko": 0.05, "spitch": -16.0, "ppitch": -18.0,
              "pz": S["pz"] + 0.06, "lh": (0.3, 0.1, 0.3), "rh": (0.1, -0.2, 0.3)}
    chop = {f: (0.95, 0.06, 0.85), side + "fp": 30.0, "spitch": S["spitch"] + 10, "ppitch": 0.0}
    chop.update(extra or {})
    marks = ["hit"] + ([f"vfx:{vfx}"] if vfx else [])
    return seq(S, [(k, raise_, "out"), (a, chop, "snap", marks), (max(1, r // 2), {f: (0.7, 0.06, 0.15)}, "io"),
                   (r - max(1, r // 2), S, "io")])


def low_kick(S, fd, side="r", extra=None, vfx=None):
    """Muay Thai style low roundhouse to the thigh/calf."""
    k, a, r = timing(*fd)
    f = side + "f"
    chamber = {f: (0.0, 0.05, 0.3), side + "fp": 40.0, "pyaw": S["pyaw"] + 25, "lfy": 50.0}
    strike = {f: (0.85, -0.12, 0.28), side + "fp": 50.0, "pyaw": S["pyaw"] + 65, "syaw": S["syaw"] + 30,
              "spitch": S["spitch"] - 2, "lfy": 75.0, "rh": (0.0, -0.3, 0.3), "rko": 0.9}
    strike.update(extra or {})
    marks = ["hit"] + ([f"vfx:{vfx}"] if vfx else [])
    return seq(S, [(k, chamber, "out"), (a, strike, "snap", marks)] + recover(r, S))


# ----------------------------------------------------------------------------------------------- crouch

def crouch_jab(S, fd, side="l", target=(0.98, -0.3, -0.05), extra=None):
    k, a, r = timing(*fd)
    C = crouch(S)
    strike = {side + "h": target, "syaw": C["syaw"] - 10 if side == "l" else C["syaw"] + 30, "px": 0.03}
    strike.update(extra or {})
    return seq(C, [(k, {side + "h": (0.45, -0.3, -0.05)}, "in"), (a, strike, "snap", "hit")] + recover(r, C))


def crouch_kick(S, fd, side="l", extra=None):
    """Low toe poke along the floor from a crouch."""
    k, a, r = timing(*fd)
    C = crouch(S)
    f = side + "f"
    strike = {f: (0.95, 0.1, 0.04), side + "fp": 0.0, "pz": C["pz"] - 0.03, "spitch": C["spitch"] - 6,
              "px": -0.04}
    strike.update(extra or {})
    return seq(C, [(k, {f: (0.5, 0.12, 0.06)}, "out"), (a, strike, "snap", "hit")] + recover(r, C))


def crouch_launcher(S, fd, side="r", extra=None, vfx=None):
    """Rising anti-air from a crouch (uppercut or palm)."""
    k, a, r = timing(*fd)
    C = crouch(S)
    h = side + "h"
    load = {h: (0.2, -0.55, 0.0), "pz": C["pz"] - 0.04, "syaw": C["syaw"] - 10}
    rise = {h: (0.35, 0.95, -0.1), "pz": S["pz"] - 0.02, "spitch": -4.0,
            "ppitch": 2.0, "syaw": S["syaw"] + 30, "pyaw": S["pyaw"] + 16, "hpitch": -14.0,
            "lf": C["lf"], "rf": C["rf"], "rfp": 25.0, "rtp": 0.0}
    rise.update(extra or {})
    marks = ["hit"] + ([f"vfx:{vfx}"] if vfx else [])
    return seq(C, [(k, load, "in"), (a, rise, "snap", marks), (max(1, r // 3), {}, "lin"),
                   (r - max(1, r // 3), C, "io")])


def sweep(S, fd, side="r", extra=None, vfx=None):
    """Low spinning sweep with the rear leg, hand on the floor."""
    k, a, r = timing(*fd)
    C = crouch(S)
    f = side + "f"
    load = {"pz": C["pz"] - 0.08, "pyaw": C["pyaw"] + 20, "syaw": C["syaw"] + 10, f: (-0.25, 0.25, 0.02),
            "lh": (0.6, -0.9, 0.2)}
    strike = {f: (1.0, -0.05, 0.03), side + "fp": 30.0, "pz": C["pz"] - 0.12, "pyaw": C["pyaw"] + 85,
              "syaw": C["syaw"] + 55, "spitch": 28.0, "lfy": 70.0, "lh": (0.55, -0.95, 0.25),
              "rh": (-0.1, -0.4, 0.4), "rko": 0.95}
    strike.update(extra or {})
    marks = ["hit"] + ([f"vfx:{vfx}"] if vfx else [])
    return seq(C, [(k, load, "in"), (a, strike, "snap", marks)] + recover(r, C))


# -------------------------------------------------------------------------------------------------- air

def air_punch(S, fd, side="r", extra=None):
    k, a, r = timing(*fd)
    A = air(S)
    strike = {side + "h": (0.85, -0.4, -0.08), "spitch": 22.0, "syaw": S["syaw"] + 30,
              "pyaw": S["pyaw"] + 14}
    strike.update(extra or {})
    return seq(A, [(k, {side + "h": (0.1, 0.35, 0.2)}, "in"),
                   (a, strike, "snap", "hit"), (r, A, "io")])


def air_kick(S, fd, side="l", extra=None):
    k, a, r = timing(*fd)
    A = air(S)
    f = side + "f"
    strike = {f: (0.8, 0.06, 0.12), side + "fp": 35.0, "spitch": -2.0, "ppitch": -4.0,
              "rf": (-0.15, 0.14, 0.6), "rfp": 50.0}
    strike.update(extra or {})
    return seq(A, [(k, {f: (0.3, 0.08, 0.55)}, "out"), (a, strike, "snap", "hit"), (r, A, "io")])


def knee(S, fd, side="r", airborne=True, extra=None):
    """Flying or standing knee: the knee drives up and forward, hands pull down."""
    k, a, r = timing(*fd)
    base = air(S) if airborne else S
    f = side + "f"
    strike = {f: (0.35, 0.05, 0.55), side + "fp": 60.0, side + "ko": 0.1, "spitch": 8.0,
              "lh": (0.75, -0.2, -0.05), "rh": (0.7, -0.25, -0.15), "lfist": 0.4, "rfist": 0.4}
    strike.update(extra or {})
    return seq(base, [(k, {f: (0.0, 0.05, 0.35)}, "in"), (a, strike, "snap", "hit"), (r, base, "io")])


# ---------------------------------------------------------------------------------------- casts / grabs

def cast(S, fd, two_hands=True, chamber=None, release=None, vfx=None, hold_frames=0, extra=None):
    """Projectile pose: wind the hands back by the hip, then thrust forward and square up."""
    k, a, r = timing(*fd)
    ch = {"lh": (0.1, -0.45, 0.0), "rh": (-0.05, -0.45, 0.05), "syaw": S["syaw"] - 24, "pyaw": S["pyaw"] - 8,
          "spitch": S["spitch"] - 4, "lfist": 0.4, "rfist": 0.4} if two_hands else \
         {"rh": (-0.1, -0.4, 0.1), "syaw": S["syaw"] - 20, "rfist": 0.5}
    ch.update(chamber or {})
    rel = {"lh": (0.95, -0.05, -0.12), "rh": (0.95, -0.12, -0.25), "syaw": S["syaw"] + 26, "pyaw": S["pyaw"] + 12,
           "spitch": S["spitch"] + 10, "px": S["px"] + 0.06, "lf": (S["lf"][0] + 0.06, S["lf"][1], 0.0),
           "lfist": 0.0, "rfist": 0.0, "rfp": 20.0, "rtp": 0.0} if two_hands else \
          {"rh": (1.0, -0.02, -0.18), "syaw": S["syaw"] + 40, "pyaw": S["pyaw"] + 20, "rfist": 0.0}
    rel.update(release or {})
    rel.update(extra or {})
    marks = ["hit"] + ([f"vfx:{vfx}"] if vfx else [])
    segs = [(k, ch, "in"), (a, rel, "snap", marks)]
    if hold_frames:
        segs.append((hold_frames, {}, "lin"))
    return seq(S, segs + recover(r, S))


def grab_and_shove(S, fd, extra_pull=None, extra_shove=None, vfx=None):
    """Generic throw: reach, clinch and pull, then shove away with a step."""
    reach = {"lh": (0.85, -0.1, -0.05), "rh": (0.8, -0.15, -0.2), "lfist": 0.3, "rfist": 0.3,
             "spitch": S["spitch"] + 10, "px": 0.04}
    clinch = {"lh": (0.55, -0.1, -0.1), "rh": (0.5, -0.15, -0.25), "lfist": 1.0, "rfist": 1.0,
              "spitch": S["spitch"] + 4, "pz": S["pz"] - 0.03}
    clinch.update(extra_pull or {})
    shove = {"lh": (1.0, -0.05, -0.1), "rh": (1.0, -0.1, -0.25), "lfist": 0.0, "rfist": 0.0,
             "syaw": S["syaw"] + 20, "spitch": S["spitch"] + 14, "px": 0.1,
             "lf": (S["lf"][0] + 0.12, S["lf"][1], 0.0), "rfp": 30.0, "rtp": 0.0}
    shove.update(extra_shove or {})
    marks = ["hit"] + ([f"vfx:{vfx}"] if vfx else [])
    return seq(S, [(2, reach, "out", "hit"), (2, clinch, "io"), (1, {}, "lin"), (2, shove, "snap", marks[1:]),
                   (1, {}, "lin"), (3, S, "io")], fps=15)
