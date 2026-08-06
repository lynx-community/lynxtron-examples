import { Button, Icon } from '../bp';
import './TemplatePicker.css';
import { PlatformOverlay } from '../../components/shared/PlatformOverlay';

export interface TemplatePickerProps {
  onPickBlank: () => void;
  onPickHelloLynxtron: () => void;
  /** Hand off to the gallery — the one place showcases live. */
  onBrowseShowcases: () => void;
  onCancel: () => void;
}

/**
 * New Fiddle.
 *
 * This dialog used to carry a second copy of the showcase registry: the same
 * eleven entries the gallery renders, in a weaker card with no thumbnail, no
 * description beyond two lines, tags as bare text, and no Run or IDE. It also
 * silently omitted the 55-entry Electron Fiddles collection, so the list looked
 * complete while showing a subset — the worst way to be wrong.
 *
 * Two renderings of one registry is one too many, and the gallery's is strictly
 * the better one. So this keeps only what a dialog should hold: the choice you
 * can make in a sentence. Picking among eleven showcases, and deciding whether
 * to open, run, or IDE one, is a page — and there is already a page for it.
 */
export function TemplatePicker(props: TemplatePickerProps) {
  return (
    <PlatformOverlay priority={100}>
      <view className="TemplatePicker-Overlay" bindtap={props.onCancel} />
      <view className="TemplatePicker-Wrap">
        <view className="TemplatePicker">
          <view className="TemplatePicker-Header">
            <text className="TemplatePicker-Title">New Fiddle</text>
            <Button icon="cross" minimal onClick={props.onCancel} />
          </view>
          <view className="TemplatePicker-Body">
            <view className="TemplatePicker-Card" bindtap={props.onPickBlank}>
              <view className="TemplatePicker-CardTitleRow">
                <Icon icon="document" size={13} className="TemplatePicker-CardIcon" />
                <text className="TemplatePicker-CardTitle">Blank</text>
              </view>
              <text className="TemplatePicker-CardDesc">Empty main + renderer + package.json</text>
            </view>
            <view className="TemplatePicker-Card" bindtap={props.onPickHelloLynxtron}>
              <view className="TemplatePicker-CardTitleRow">
                <Icon icon="code" size={13} className="TemplatePicker-CardIcon" />
                <text className="TemplatePicker-CardTitle">Hello Lynxtron</text>
              </view>
              <text className="TemplatePicker-CardDesc">Minimal LynxWindow + ReactLynx greeting</text>
            </view>
          </view>
          {/* Not a third starter — a door. Showcases have thumbnails, tags and
              three actions each, plus a 55-fiddle collection; that is a page,
              and it already exists. */}
          <view className="TemplatePicker-Foot" bindtap={props.onBrowseShowcases}>
            <text className="TemplatePicker-FootText">Start from a showcase</text>
            <text className="TemplatePicker-FootArrow">→</text>
          </view>
        </view>
      </view>
    </PlatformOverlay>
  );
}
