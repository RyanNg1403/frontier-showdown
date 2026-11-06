"""Sam Altman, "The Iterative Deployer" (roster doc 3.1; frame data: src/characters/sam.js).

Relaxed and understated: loose fists at chest height, minimal wind-ups, clean follow-through.
"""

from _kit import Kit, box, cylinder, merge, put, seq, timing
import _library as lib

TEAL = "#79e4cf"


def make_props(k):
    k.prop("phone", box("phone", 0.08, 0.014, 0.16), "#d5d8de", "hand_r", offset=(0.0, 0.05, 0.035),
           rot=(10, 0, 0), contrast=0.6)
    k.prop("badge", merge("badge", box("card", 0.075, 0.006, 0.1, at=(0, 0, 0)),
                          box("strap_l", 0.012, 0.004, 0.2, at=(-0.05, 0.02, 0.13)),
                          box("strap_r", 0.012, 0.004, 0.2, at=(0.05, 0.02, 0.13))),
           "#f2f2ee", "spine_03", offset=(0.0, -0.215, 0.03), space="armature", part="torso")
    k.prop("badge_hand", merge("badge_hand", box("card", 0.075, 0.006, 0.1),
                               box("loop", 0.012, 0.004, 0.32, at=(0.0, 0.0, 0.2))),
           "#f2f2ee", "hand_r", offset=(0.0, 0.06, 0.0), rot=(90, 0, 0))
    k.prop("deploy_plinth", box("plinth", 0.2, 0.2, 0.84, at=(0, 0, 0.42)), "#4a4f5c", "Root",
           offset=(0.0, -0.62, 0.0), space="armature", part="torso")
    k.prop("deploy_button", cylinder("button", 0.09, 0.07, axis="Z", at=(0, 0, 0.875)), TEAL, "Root",
           offset=(0.0, -0.62, 0.0), space="armature", part="torso", contrast=0.6)


def moves(k):
    S = k.stance()
    m = {}

    m["light_punch"] = lib.jab(S, (6, 2, 11))
    m["heavy_punch"] = lib.straight(S, (12, 3, 20), overhand=True, vfx="teal_streak")
    m["light_kick"] = lib.front_kick(S, (9, 3, 13), height=0.32, reach=0.8, toe=20.0)
    m["heavy_kick"] = lib.roundhouse(S, (14, 4, 22), height=0.82, vfx="chat_bubble_trail")
    m["crouch_light"] = lib.crouch_jab(S, (7, 2, 12))
    m["crouch_light_kick"] = lib.crouch_kick(S, (8, 2, 13))
    m["crouch_heavy"] = lib.crouch_launcher(S, (10, 3, 32), vfx="teal_streak")
    m["crouch_heavy_kick"] = lib.sweep(S, (13, 3, 28))
    m["air_attack"] = lib.air_punch(S, (8, 6, 8))
    m["air_kick"] = lib.air_kick(S, (7, 7, 8), extra={"lf": (0.7, 0.06, 0.0), "lfp": -20.0})  # sneaker stomp

    # F+HP "Ship It": two-handed hammer onto a glowing deploy button.
    kk, a, r = timing(20, 3, 20)
    up = {"lh": (0.15, 0.85, -0.25), "rh": (0.1, 0.85, -0.35),
          "spitch": -6.0, "syaw": S["syaw"] + 20, "pz": S["pz"] + 0.03, "props": {"deploy_button": True, "deploy_plinth": True}}
    slam = {"lh": (0.85, -0.55, -0.3), "rh": (0.82, -0.6, -0.42), "spitch": 30.0, "pz": S["pz"] - 0.06,
            "npitch": -10.0, "hpitch": -12.0}
    m["ship_it"] = seq(put(S, props={"deploy_button": True, "deploy_plinth": True}),
                       [(2, {"props": {"deploy_button": True, "deploy_plinth": True}}, "lin"), (kk - 2, up, "out"),
                        (a, slam, "snap", ["hit", "vfx:deploy_flash"])] + lib.recover(r, put(S, props={"deploy_button": True, "deploy_plinth": True})),
                       note="F+HP command normal; set anim: 'ship_it' in the character data to use it")

    # Throw "Code Red": grab, red alert light, shove.
    m["throw"] = lib.grab_and_shove(S, None, vfx="red_alert")

    # Prompt Burst: quick two-hand push that releases the chat bubble at chest height.
    m["special_1"] = lib.cast(S, (15, 2, 30), vfx="prompt_burst",
                              release={"lh": (0.95, -0.12, -0.1), "rh": (0.95, -0.18, -0.24)})
    # Event Horizon: invincible rising uppercut wrapped in a singularity ring.
    m["special_2"] = lib.uppercut(S, (5, 8, 36), side="r", airborne=0.45, vfx="singularity_ring")
    # Stargate Rush: lean into the gate, vanish, reappear with a knee.
    kk, a, r = timing(16, 4, 26)
    step = {"px": 0.08, "spitch": 24.0, "lf": (0.48, 0.12, 0.0), "rfp": 40.0, "rtp": 0.0,
            "lh": (0.6, -0.4, 0.05), "rh": (0.2, -0.5, 0.1), "pz": S["pz"] - 0.05}
    kneeup = {"rf": (0.32, 0.05, 0.55), "rfp": 60.0, "rko": 0.1, "lf": (0.0, 0.1, 0.12), "lfp": 35.0,
              "px": 0.0, "spitch": 6.0, "pz": S["pz"] + 0.04, "lh": (0.7, -0.25, -0.05), "rh": (0.65, -0.3, -0.18),
              "lfist": 0.5, "rfist": 0.5}
    m["special_3"] = seq(S, [(2, step, "io", "vfx:stargate_open"), (kk - 2, put(step, spitch=34.0, px=0.14), "in"),
                             (a, kneeup, "snap", ["hit", "vfx:stargate_exit"])] + lib.recover(r, S))

    # A Few Thousand Days: dash through an exponential curve, alternating strikes, price-tag slam.
    run_lean = {"spitch": 26.0, "pz": S["pz"] - 0.04, "lf": (0.45, 0.1, 0.0), "rf": (-0.45, 0.14, 0.0),
                "rfp": 40.0, "rtp": 0.0, "px": 0.06}
    segs = [(2, put(run_lean, lh=(0.3, -0.3, 0.0), rh=(0.1, -0.4, 0.0)), "in", "vfx:day_counter")]
    for i in range(6):
        side = "lh" if i % 2 == 0 else "rh"
        other = "rh" if side == "lh" else "lh"
        segs.append((1, {side: (0.98, -0.05 - 0.05 * (i % 3), -0.1), other: (0.3, -0.3, -0.05),
                         "syaw": S["syaw"] + (-10 if side == "lh" else 30)}, "snap", "hit" if i == 0 else []))
    segs.append((2, {"lh": (0.4, 0.9, -0.2), "rh": (0.35, 0.9, -0.3), "spitch": -4.0, "pz": S["pz"] + 0.05,
                     "lfist": 1.0, "rfist": 1.0}, "out"))
    segs.append((2, {"lh": (0.9, -0.5, -0.25), "rh": (0.88, -0.55, -0.35), "spitch": 30.0, "pz": S["pz"] - 0.08},
                 "snap", "vfx:price_tag_slam"))
    segs += lib.recover(6, S)
    m["super"] = seq(S, segs, fps=20)

    # Finisher "Gentle Singularity": a gentle palm-up lift, a slow circling hand, then a glance at the phone.
    lift = {"rh": (0.8, 0.1, -0.05), "rfist": 0.0, "syaw": S["syaw"] + 20,
            "spitch": 2.0, "pz": S["pz"] + 0.05}
    m["finisher"] = seq(S, [(2, lift, "io", "vfx:singularity_lift"),
                            (2, {"rh": (0.75, 0.55, -0.05)}, "io"), (2, {"rh": (0.85, 0.3, 0.15)}, "io"),
                            (2, {"rh": (0.75, 0.55, -0.15)}, "io"), (2, {}, "lin", "vfx:chatbot_avatar"),
                            (2, {"rh": (0.45, -0.1, -0.1), "rfist": 0.6, "hpitch": 12.0, "npitch": 8.0,
                                 "props": {"phone": True}}, "io"),
                            (3, {}, "lin")], fps=10)

    # Intro: glances at the phone, pockets it, settles into the guard.
    calm = put(S, pz=-0.03, pyaw=-10.0, syaw=-18.0, spitch=2.0, lf=(0.12, 0.1, 0.0), rf=(-0.12, 0.12, 0.0),
               lfy=8.0, rfy=12.0, lh=(0.05, -0.75, 0.12), rh=(0.45, -0.15, -0.1), rfist=0.6, lfist=0.2,
               hpitch=14.0, npitch=8.0, props={"phone": True})
    m["intro"] = seq(calm, [(3, {}, "lin"), (2, {"hpitch": 0.0, "npitch": 2.0}, "io"),
                            (2, {"rh": (0.0, -0.7, 0.1), "props": {}}, "io"), (3, S, "io"), (2, {}, "lin")], fps=8)

    # Victory: puts on the visitor badge ("first and last time i ever wear one of these").
    pre = put(S, pz=-0.03, pyaw=-10.0, syaw=-16.0, spitch=0.0, lf=(0.12, 0.1, 0.0), rf=(-0.12, 0.12, 0.0),
              lfy=8.0, rfy=12.0, lh=(0.05, -0.75, 0.12), rh=(0.4, -0.2, -0.1), lfist=0.2, rfist=0.8,
              props={"badge_hand": True})
    m["victory"] = seq(pre, [(2, {"rh": (0.35, 0.5, -0.1), "lh": (0.3, 0.5, -0.25), "lfist": 0.8,
                                  "props": {"badge_hand": True}}, "io"),
                             (2, {"rh": (0.15, 0.95, -0.2), "lh": (0.1, 0.95, -0.35)}, "io"),
                             (2, {"rh": (0.2, -0.1, -0.2), "lh": (0.2, -0.1, -0.35), "props": {"badge": True}}, "io"),
                             (2, {"rh": (0.05, -0.75, 0.1), "lh": (0.05, -0.75, 0.12), "rfist": 0.2, "lfist": 0.2,
                                  "hpitch": 6.0, "props": {"badge": True}}, "io"),
                             (3, {"proll": 2.0, "sroll": -4.0, "props": {"badge": True}}, "io")], fps=8)
    return m


HEADS = {"super": "shout", "victory": "victory"}


def animations(fighter_id, sk, cfg, ctx=None):
    if fighter_id != "sam":
        return {}
    k = Kit(sk, cfg, ctx)
    make_props(k)
    return {name: k.anim(m, head=HEADS.get(name, "threequarter")) for name, m in moves(k).items()}
