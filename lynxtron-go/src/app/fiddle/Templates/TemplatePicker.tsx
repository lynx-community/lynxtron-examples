import { SHOWCASE_REGISTRY, type ShowcaseEntry } from '../../store';
import { Button, Icon } from '../bp';
import './TemplatePicker.css';

export interface TemplatePickerProps {
  onPickBlank: () => void;
  onPickHelloLynxtron: () => void;
  onPickShowcase: (entry: ShowcaseEntry) => void;
  onCancel: () => void;
}

export function TemplatePicker(props: TemplatePickerProps) {
  return (
    <view className="TemplatePicker-Overlay">
      <view className="TemplatePicker">
        <view className="TemplatePicker-Header">
          <text className="TemplatePicker-Title">New Fiddle from Template</text>
          <Button icon="cross" minimal onClick={props.onCancel} />
        </view>
        <scroll-view className="TemplatePicker-Body" scroll-orientation="vertical">
          <view className="TemplatePicker-Section">
            <text className="TemplatePicker-SectionTitle">STARTERS</text>
            <view className="TemplatePicker-Grid">
              <view className="TemplatePicker-Card TemplatePicker-Card--wide" bindtap={props.onPickBlank}>
                <view className="TemplatePicker-CardTitleRow">
                  <Icon icon="document" size={13} color="#608291" />
                  <text className="TemplatePicker-CardTitle">Blank</text>
                </view>
                <text className="TemplatePicker-CardDesc" text-maxline="2">Empty main + renderer + package.json</text>
              </view>
              <view className="TemplatePicker-Card TemplatePicker-Card--wide" bindtap={props.onPickHelloLynxtron}>
                <view className="TemplatePicker-CardTitleRow">
                  <Icon icon="code" size={13} color="#608291" />
                  <text className="TemplatePicker-CardTitle">Hello Lynxtron</text>
                </view>
                <text className="TemplatePicker-CardDesc" text-maxline="2">Minimal LynxWindow + ReactLynx greeting</text>
              </view>
            </view>
          </view>
          <view className="TemplatePicker-Section">
            <text className="TemplatePicker-SectionTitle">SHOWCASES</text>
            <view className="TemplatePicker-Grid">
              {SHOWCASE_REGISTRY.map(sc => (
                <view
                  key={sc.name}
                  className="TemplatePicker-Card"
                  bindtap={() => props.onPickShowcase(sc)}
                >
                  <text className="TemplatePicker-CardTitle">{sc.name}</text>
                  <text className="TemplatePicker-CardDesc" text-maxline="2">{sc.description}</text>
                  <view className="TemplatePicker-CardTags">
                    {sc.tags.map(t => (
                      <text key={t} className="TemplatePicker-Tag">{t}</text>
                    ))}
                  </view>
                </view>
              ))}
            </view>
          </view>
        </scroll-view>
      </view>
    </view>
  );
}
