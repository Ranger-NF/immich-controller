const { GObject, St, Gio } = imports.gi;

const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const { Subprocess, SubprocessFlags } = imports.gi.Gio;

const Gettext = imports.gettext;
const ExtensionUtils = imports.misc.extensionUtils;

const Me = ExtensionUtils.getCurrentExtension();
const Domain = Gettext.domain(Me.metadata.uuid);

ExtensionUtils.initTranslations(Me.metadata.uuid);
const _ = Domain.gettext;

const Scripts = {
    START: ['/home/fahad/Scripts/immich-start.sh'],
    STOP: ['/home/fahad/Scripts/immich-stop.sh'],
    STATUS: ['/home/fahad/Scripts/immich-status.sh', 'pc']
}

const State = {
	WORKING: "working",
	PAUSED: "paused",
};

const extensionTitle = "🌸 Immich";

class ImmichPanelIcon {
	constructor() {
		this._workingIcon = new St.Icon({
			gicon: Gio.icon_new_for_string(Me.path + '/icons/immich.svg'),
			icon_size: 20
		});
		this._pausedIcon = new St.Icon({
			gicon: Gio.icon_new_for_string(Me.path + '/icons/immich-paused.svg'),
			icon_size: 20
		});
		this.actor = new St.Bin();
		this.actor.set_child(this._pausedIcon);
	}

    setState(state) {
		switch (state) {
			case State.WORKING:
				this.actor.set_child(this._workingIcon);
				break
			case State.PAUSED:
				this.actor.set_child(this._pausedIcon);
				break;
			default:
				this.actor.set_child(this._pausedIcon);
				break
		}
    }

}

let serverStateChanger

async function check_status() {
    const proc = Subprocess.new(Scripts.STATUS, SubprocessFlags.NONE);

    const cancellable = new Gio.Cancellable();

    await proc.wait_async(cancellable, () => {
        if (proc.get_successful()) {
            Main.notify(_(extensionTitle),_('Server Running.. 🥳'));
            serverStateChanger.setToggleState(true)
            return true
        } else {
            Main.notify(_(extensionTitle), _('Server Stopped.. 🚧'));
            serverStateChanger.setToggleState(false)
            return false
        }
    });
}

async function runScript(command) {
    try {
        if (command == Scripts.STATUS) {
            let result = await check_status()
            return result
        }

        const proc = Subprocess.new(command, SubprocessFlags.NONE);
        const cancellable = new Gio.Cancellable();
    
        await proc.wait_async(cancellable, ()=> {});
    
    } catch (e) {
        logError(e);
    }
}

class ImmichIndicator extends PanelMenu.Button {
    _init() {
        super._init(0.0, _('Docker Controller Indicator'));

        this.icon = new ImmichPanelIcon();
        this.add_actor(this.icon.actor);

        let headerSeperator = new PopupMenu.PopupSeparatorMenuItem(_(extensionTitle))
        
        serverStateChanger = new PopupMenu.PopupSwitchMenuItem(_("📟 Server"), false, {})
        serverStateChanger.connect('toggled', (_item, state) => {
            if (state == true) {
                this.icon.setState(State.WORKING)
                runScript(Scripts.START)
                Main.notify(_(extensionTitle),_('Starting Immich server... 🥳'));
            } else {
                this.icon.setState(State.PAUSED)
                runScript(Scripts.STOP)
                Main.notify(_(extensionTitle), _('Stopping Immich server... 🛑'));
            }
        });

        let seperator = new PopupMenu.PopupSeparatorMenuItem();


        let refreshButton = new PopupMenu.PopupMenuItem(_('🔁 Refresh'));
        refreshButton.connect('activate', () => {
            runScript(Scripts.STATUS)
        });
        this.menu.addMenuItem(headerSeperator);
        this.menu.addMenuItem(serverStateChanger);
        this.menu.addMenuItem(seperator);
        this.menu.addMenuItem(refreshButton);

        check_status()
    }

    // updateStateVisually(state) {
    //     pass
    // }
}

ImmichIndicator = GObject.registerClass({ GTypeName: 'ImmichIndicator' }, ImmichIndicator)

class Extension {
    constructor(uuid) {
        this._uuid = uuid;
    }

    enable() {
        this._indicator = new ImmichIndicator(this);
        Main.panel.addToStatusArea(this._uuid, this._indicator);
    }

    disable() {
        this._indicator.destroy();
        this._indicator = null;
    }
}

function init(meta) {
    return new Extension(meta.uuid);
}
