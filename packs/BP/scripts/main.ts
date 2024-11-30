import { Player, RawMessage, Vector3, system, world } from "@minecraft/server"
import { ActionFormData, ModalFormData } from "@minecraft/server-ui"
import { angleDifference, roundToTwoDp } from "./utils"
import { Vector3Utils as Vector, VECTOR3_ZERO } from "@minecraft/math"

const MAX_DIFFERENCE = 50

const credits: RawMessage = {
    text:
        `Waypoints Add-On
Created by Hatchibombotar

Website: https://hatchibombotar.com`
}

function formatLocation({ x, y, z }: Vector3) {
    return [x, y, z].map(p => Math.round(p)).join(", ")
}

function formatDimensionString(dimension: string): string {
    dimension = dimension.replace("minecraft:", "")
    dimension = dimension[0].toUpperCase() + dimension.slice(1)
    return dimension
}

const colours = [
    ["black", "0"],
    ["dark_blue", "1"],
    ["dark_green", "2"],
    ["dark_aqua", "3"],
    ["dark_red", "4"],
    ["dark_purple", "5"],
    ["gold", "6"],
    ["gray", "7"],
    ["dark_gray", "8"],
    ["blue", "9"],
    ["green", "a"],
    ["aqua", "b"],
    ["red", "c"],
    ["light_purple", "d"],
    ["yellow", "e"],
    ["white", "f"],
]

type Data = {
    players: {
        [id: string]: {
            waypoints: Waypoint[],
            options: Options
        }
    }
}

type Waypoint = {
    name: string,
    location: Vector3,
    colour: number,
    icon: number,
    entityId: string | null,
    dimension: string
}

type Options = {
    showWaypoints: boolean,
    allowWaypointSharing: boolean
}

let data: Data = {
    players: {}
}

function tick() {
    const waypointIds: string[] = []
    for (const player of Object.values(data.players)) {
        for (const waypoint of player.waypoints) {
            if (waypoint.entityId) {
                waypointIds.push(waypoint.entityId)
            }
        }
    }

    for (const dimensionId of ["overworld", "nether", "the_end"]) {
        const dimension = world.getDimension(dimensionId)
        for (const waypoint of dimension.getEntities({
            type: "hatchi:waypoint"
        })) {
            if (!waypointIds.includes(waypoint.id)) {
                waypoint.remove()
            }
        }
    }

    for (const playerId of Object.keys(data.players)) {
        const player = world.getEntity(playerId)
        if (player == null) return

        const waypoints = data.players[playerId].waypoints
        const playerHead = player.getHeadLocation()

        const lookingAtWaypoints: Waypoint[] = []

        if (!data.players[playerId].options.showWaypoints) {
            for (const waypoint of waypoints.values()) {
                if (waypoint.entityId != null) {
                    try {
                        const waypointEntity = world.getEntity(waypoint.entityId)
                        if (waypointEntity != null) {
                            waypointEntity.remove()
                        }
                        waypoint.entityId = null
                    } catch (err) { }
                }
            }
            continue
        }

        for (const waypoint of waypoints.values()) {
            if (waypoint.dimension !== player.dimension.id) {
                continue
            }
            const diff = Vector.subtract(Vector.add(waypoint.location, { x: 0, y: 1, z: 0 }), playerHead) // Move from player to waypoint
            const magnitude = Vector.distance(VECTOR3_ZERO, diff)
            const unit = Vector.scale(diff, 1 / magnitude)
            const resultMagnitude = Math.min(MAX_DIFFERENCE, magnitude)
            const result = Vector.add(Vector.scale(unit, resultMagnitude), playerHead)

            const yAngle = (Math.atan2(diff.z, diff.x) * (180 / Math.PI)) - 90
            const playerYAngle = player.getRotation().y
            const YAngleBetween = angleDifference(yAngle, playerYAngle)

            const magnitudeXZ = Math.sqrt(diff.x ** 2 + diff.z ** 2)
            const XAngle = -Math.atan2(diff.y, magnitudeXZ) * (180 / Math.PI)
            const playerXAngle = player.getRotation().x
            const xAngleBetween = angleDifference(XAngle, playerXAngle)

            // const varmap = new MolangVariableMap()
            // varmap.setFloat("variable.angle_y", player_y_angle)
            // varmap.setFloat("variable.angle_x", player_x_angle)
            // varmap.setColorRGB("variable.colour", {red: 1, green: 1, blue: 0})
            // player.dimension.spawnParticle("hatchi:angle_display", player_location, varmap)

            // const varmap2 = new MolangVariableMap()
            // varmap2.setFloat("variable.angle_y", y_angle)
            // varmap2.setFloat("variable.angle_x", x_angle)
            // varmap2.setColorRGB("variable.colour", {red: 0, green: 1, blue: 1})
            // player.dimension.spawnParticle("hatchi:angle_display", player_location, varmap2)

            // player.runCommand(`title @s actionbar ${x_angle} ${player_x_angle}`)
            // player.runCommand(`title @s actionbar ${normaliseAngle(player_y_angle)}`)

            if (YAngleBetween < 5 && xAngleBetween < 5) {
                lookingAtWaypoints.push(waypoint)
            }

            const dimension = world.getDimension(waypoint.dimension)

            if (waypoint.entityId == null) {
                try {
                    const waypointEntity = dimension.spawnEntity("hatchi:waypoint", result)

                    waypointEntity.setProperty("hatchi:waypoint_background", waypoint.colour)
                    waypointEntity.setProperty("hatchi:waypoint_symbol", waypoint.icon)

                    waypoint.entityId = waypointEntity.id
                } catch (err) {
                    return
                }
            }
            try {
                const waypointEntity = world.getEntity(waypoint.entityId)
                if (waypointEntity == null) {
                    waypoint.entityId = null
                    continue
                }
                waypointEntity.teleport(result)
            }  catch (err) { }
        }

        const rawtext: RawMessage = {
            rawtext: []
        }
        for (const waypoint of lookingAtWaypoints) {

            const dist = Math.round(Vector.magnitude(Vector.subtract(waypoint.location, player.location)))

            rawtext.rawtext!.push({
                text: `${waypoint.name} - ${dist}m\n`
            })
        }
        if (lookingAtWaypoints.length > 0) {
            player.runCommand(`titleraw @s times 0 1 0`)
            player.runCommand(`titleraw @s actionbar ${JSON.stringify(rawtext)}`)
        }
    }
}

function init() {
    const savedDataString = world.getDynamicProperty("hatchi:waypoint_data")
    if (savedDataString == undefined) {
        return
    }
    const savedData = JSON.parse(savedDataString as string)
    data = savedData

    for (const player of Object.values(data.players)) {
        for (const waypoint of player.waypoints) {
            if (waypoint.entityId) {
                const entity = world.getEntity(waypoint.entityId)
                if (entity) {
                    entity.remove()
                }
            }
        }
    }
}

function saveData() {
    const dataToSave = JSON.stringify(data)
    world.setDynamicProperty("hatchi:waypoint_data", dataToSave)
}

async function showWaypointsMenu(player: Player) {
    data.players[player.id] ??= {
        waypoints: [],
        options: {
            allowWaypointSharing: true,
            showWaypoints: true
        }
    }

    enum WaypointMenuItems {
        AddWaypoint,
        Waypoints,
        Settings,
        Info
    }

    const menu = new ActionFormData()
        .title({ translate: "hatchi:waypoints.ui.main_menu.title" })
        .button({ translate: "hatchi:waypoints.ui.main_menu.add_waypoint" })
        .button({ translate: "hatchi:waypoints.ui.main_menu.waypoint_list" })
        .button({ translate: "hatchi:waypoints.ui.main_menu.settings" })
        .button({ translate: "hatchi:waypoints.ui.main_menu.info" })

    const response = await menu.show(player)
    const selection: WaypointMenuItems | undefined = response.selection

    if (selection == WaypointMenuItems.AddWaypoint) {
        const waypoint: Waypoint = {
            name: "My Waypoint",
            colour: 0,
            icon: 0,
            entityId: null,
            location: {
                x: Math.round(player.location.x),
                y: Math.round(player.location.y),
                z: Math.round(player.location.z)
            },
            dimension: player.dimension.id
        }

        const success = await editWaypoint(player, waypoint)
        if (success) {
            data.players[player.id].waypoints.push(waypoint)
            saveData()
        }

    } else if (selection == WaypointMenuItems.Waypoints) {
        const waypoints = data.players[player.id].waypoints
        if (waypoints.length == 0) {
            const noWaypoints = new ActionFormData()
                .title({ "translate": "hatchi:waypoints.ui.waypoint_list.title" })
                .body({ "translate": "hatchi:waypoints.ui.waypoint_list.empty" })
                .button({ "translate": "hatchi:waypoints.ui.close" })

            noWaypoints.show(player)
            return
        }
        const waypointList = new ActionFormData().title({ translate: "hatchi:waypoints.ui.waypoint_list.title" })

        for (const waypoint of waypoints) {
            waypointList.button("§" + colours[waypoint.colour][1] + waypoint.name)
        }

        const response = await waypointList.show(player)
        const waypointIndex = response.selection

        if (response.canceled || waypointIndex == undefined) {
            return
        }

        const waypoint = waypoints[waypointIndex]

        const optionMenu = new ActionFormData()
            .title(waypoint.name)
            .button({ translate: "hatchi:waypoints.ui.waypoint_actions.edit" })
            .button({ translate: "hatchi:waypoints.ui.waypoint_actions.share" })
            .button({ translate: "hatchi:waypoints.ui.waypoint_actions.delete" })
            .button({ translate: "hatchi:waypoints.ui.close" })

        const selection = await optionMenu.show(player)

        if (selection.selection === 0) { // edit
            const success = await editWaypoint(player, waypoint)
            if (success) {
                saveData()
            }

        } else if (selection.selection === 1) { // share
            const players = world.getAllPlayers()
            const shareSelection = new ActionFormData()
                .title({ translate: "hatchi:waypoints.ui.share.title" })
                .button({ translate: "hatchi:waypoints.ui.share.everyone" })

            for (const player of players) {
                shareSelection.button(player.name)
            }

            const playerToShareWithOption = await shareSelection.show(player)
            if (playerToShareWithOption.canceled) {
                return
            }

            let shareToPlayers: Player[] = []

            if (playerToShareWithOption.selection === 0) {
                shareToPlayers = players
            } else if (playerToShareWithOption.selection !== undefined && playerToShareWithOption.selection > 0) {
                shareToPlayers = [players[playerToShareWithOption.selection - 1]]
            }

            for (const shareToPlayer of shareToPlayers) {
                const shareToId = shareToPlayer.id
                if (data.players[shareToId].options.allowWaypointSharing === false) {
                    return
                }
                // TODO: this should be ran as a seperate async function so that one player taking ages will not prevent showing it for everyone else
                const shareAcceptMenu = new ActionFormData()
                    .title("Waypoints")
                    .body(
                        `${player.name} has shared a waypoint with you!

Name: ${waypoint.name}
Location: ${formatLocation(waypoint.location)}
Dimension: ${waypoint.dimension}`
                    )
                    .body(
                        {rawtext: [
                            {translate: "hatchi:waypoints.ui.share_recieve.share_message", with: [player.nameTag]},
                            {text: "\n\n"},
                            {translate: "hatchi:waypoints.ui.share_recieve.waypoint_name", with: [waypoint.name]},
                            {text: "\n"},
                            {translate: "hatchi:waypoints.ui.share_recieve.waypoint_location", with: [formatLocation(waypoint.location)]},
                            {text: "\n"},
                            {translate: "hatchi:waypoints.ui.share_recieve.waypoint_dimension", with: [formatDimensionString(waypoint.dimension)]},
                        ]}
                    )
                    .button({ translate: "hatchi:waypoints.ui.share_recieve.accept" })
                    .button({ translate: "hatchi:waypoints.ui.share_recieve.decline" })
                    .button({ translate: "hatchi:waypoints.ui.share_recieve.decline_and_disable" })

                const shareAcceptResponse = await shareAcceptMenu.show(shareToPlayer)

                if (shareAcceptResponse.canceled || shareAcceptResponse.selection == null) {
                    continue
                } else if (shareAcceptResponse.selection == 0) {
                    data.players[shareToId].waypoints.push(
                        { ...waypoint, entityId: null }
                    )
                    saveData()
                } else if (shareAcceptResponse.selection === 1) {

                } else if (shareAcceptResponse.selection === 2) {
                    data.players[shareToId].options.allowWaypointSharing = false
                }
            }

        } else if (selection.selection === 2) { // delete
            const confirm = new ActionFormData()
                .title("Confirm Delete")
                .body("§cAre you sure you want to delete this waypoint?")
                .button("Yes, Delete")
                .button("Cancel")

            const confirmResult = await confirm.show(player)
            if (confirmResult.selection === 0) { // delete
                waypoints.splice(waypointIndex, 1)
                data.players[player.id].waypoints = waypoints
                if (waypoint.entityId) {
                    const waypointEntity = world.getEntity(waypoint.entityId)
                    if (waypointEntity) {
                        waypointEntity.remove()
                    }
                }
                saveData()
            }
        }

    } else if (selection == WaypointMenuItems.Settings) {
        const settingsMenu = new ModalFormData()
            .title("Settings")
            .toggle("Show Waypoints", data.players[player.id].options.showWaypoints)
            .toggle("Allow Waypoint Sharing", data.players[player.id].options.allowWaypointSharing)

        const response = await settingsMenu.show(player)
        if (response.canceled) {
            return
        }
        if (response.formValues) {
            data.players[player.id].options.showWaypoints = response.formValues[0] as boolean
            data.players[player.id].options.allowWaypointSharing = response.formValues[1] as boolean
        }

        saveData()
    } else if (selection === WaypointMenuItems.Info) {
        const infoMenu = new ActionFormData()
            .title({ "translate": "hatchi:waypoints.ui.info.title" })
            .body(credits)
            .button({ "translate": "hatchi:waypoints.ui.close" })

        infoMenu.show(player)
    }

}

// shows the edit waypoint screen to the player, returns false if closed due to error or other means
async function editWaypoint(player: Player, waypoint: Waypoint): Promise<boolean> {
    const menuAddWaypoint = new ModalFormData()
        .title({ translate: "hatchi:waypoints.ui.edit_menu.title" })
        .textField({ translate: "hatchi:waypoints.ui.edit_menu.waypoint_name" }, waypoint.name, waypoint.name)
        .dropdown("colour", colours.map(([colour, code]) => (
            {
                rawtext: [
                    { text: "§" + code },
                    { translate: "color." + colour }
                ]
            }
        )), waypoint.colour)
        .textField("x", String(roundToTwoDp(waypoint.location.x)), String(roundToTwoDp(waypoint.location.x)))
        .textField("y", String(roundToTwoDp(waypoint.location.y)), String(roundToTwoDp(waypoint.location.y)))
        .textField("z", String(roundToTwoDp(waypoint.location.z)), String(roundToTwoDp(waypoint.location.z)))

    const response = await menuAddWaypoint.show(player)

    if (!response.formValues) {
        return false
    }

    const name = response.formValues[0] as string
    const colour = response.formValues[1] as number
    const x = Number(response.formValues[2] as string)
    const y = Number(response.formValues[3] as string)
    const z = Number(response.formValues[4] as string)
    const location = { x, y, z }

    const letterIconCode = name.charAt(0).toUpperCase().charCodeAt(0) - 65

    let icon = 0

    while (true) {
        const canUseLetterIcon = letterIconCode > 25 || letterIconCode < 0

        const iconMenu = new ActionFormData()
            .title({ translate: "hatchi:waypoints.ui.icon_menu.title" })

        if (canUseLetterIcon) {
            iconMenu.button({ translate: "hatchi:waypoints.ui.edit_menu.letter_icon_text_disabled" }, "textures/waypoints/form_icons/letters")
        } else {
            iconMenu.button(
                {
                    rawtext: [
                        { "translate": "hatchi:waypoints.ui.edit_menu.letter_icon_text" },
                        { "text": ` - ${name.charAt(0).toUpperCase()}` }
                    ]
                },
                "textures/waypoints/form_icons/letters"
            )
        }

        iconMenu
            .button("!", "textures/waypoints/form_icons/exclamation")
            .button("?", "textures/waypoints/form_icons/question_mark")
            .button("#", "textures/waypoints/form_icons/hash")
            .button("$", "textures/waypoints/form_icons/dollar")
            .button({ "translate": "hatchi:waypoints.ui.edit_menu.house_icon" }, "textures/waypoints/form_icons/house")

        const iconMenuResult = await iconMenu.show(player)

        if (iconMenuResult.canceled || iconMenuResult.selection == undefined) {
            return false
        }

        if (canUseLetterIcon && iconMenuResult.selection === 0) {
            continue
        }

        switch (iconMenuResult.selection) {
            case 0:
                icon = letterIconCode
                break;
            case 1:
                icon = 26
                break;
            case 2:
                icon = 28
                break;
            case 3:
                icon = 27
                break;
            case 4:
                icon = 30
                break;
            case 5:
                icon = 29
                break;
        }
        break
    }

    waypoint.location = location
    waypoint.name = name
    waypoint.colour = colour
    waypoint.icon = icon

    if (waypoint.entityId) {
        const waypointEntity = world.getEntity(waypoint.entityId)
        if (waypointEntity) {
            waypointEntity.setProperty("hatchi:waypoint_background", waypoint.colour)
            waypointEntity.setProperty("hatchi:waypoint_symbol", waypoint.icon)
        } else {
            waypoint.entityId = null
        }
    }

    return true
}

world.afterEvents.itemUse.subscribe(async (event) => {
    if (event.itemStack.typeId == "hatchi:waypoints_menu") {
        showWaypointsMenu(event.source)
    }
})

world.afterEvents.worldInitialize.subscribe(init)
system.runInterval(tick, 2)