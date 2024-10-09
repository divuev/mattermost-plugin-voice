import {css} from '@emotion/react';
import {changeOpacity} from 'mattermost-redux/utils/theme_utils';

import './post_type.css';

const React = window.React;
const PropTypes = window.PropTypes;

function pad2(n) {
    const val = n | 0;
    return val < 10 ? `0${val}` : `${Math.min(val, 99)}`;
}

function pad2nozero(n) {
    const val = n | 0;
    return val < 10 ? `${val}` : `${Math.min(val, 99)}`;
}

export default class PostType extends React.PureComponent {
  static propTypes = {
      post: PropTypes.object.isRequired,
      theme: PropTypes.object.isRequired,
      pluginURL: PropTypes.string.isRequired,
  }

  constructor(props) {
      super(props);
      this.state = {
          player: null,
          currentTime: '0:00',
          duration: '',
          playing: false,
          played: false,
          progress: 0,
          playbackRate: 1,
      };
  }

  componentDidMount() {
      const post = {...this.props.post};
      const player = document.getElementById(`voice_${post.id}`);

      const duration = player.duration > 0 ?
          player.duration : post.props.duration / 1000;

      player.addEventListener('timeupdate', (ev) => {
          const secs = Math.round(ev.target.currentTime);
          const progress = Math.round((ev.target.currentTime / duration) * 100);
          this.setState({
              currentTime: pad2nozero(secs / 60) + ':' + pad2(secs % 60),
              progress,
          });
      });

      player.addEventListener('play', () => {
          this.setState({
              playing: true,
              played: true,
          });
      });

      player.addEventListener('playing', () => {
          this.setState({
              playing: true,
          });
      });

      player.addEventListener('pause', () => {
          this.setState({
              playing: false,
          });
      });

      player.addEventListener('error', () => {
          this.setState({
              playing: false,
              played: false,
          });
      });

      player.addEventListener('ended', () => {
          this.setState({
              playing: false,
              played: false,
          });
      });

      this.setState({
          player,
          duration: pad2nozero(Math.round(duration) / 60) + ':' + pad2(Math.round(duration) % 60),
      });

      player.playbackRate = this.state.playbackRate;
  }

  play = () => {
      if (!this.state.player) {
          return;
      }
      this.state.player.play();
  }

  pause = () => {
      if (!this.state.player) {
          return;
      }
      this.state.player.pause();
  }

  onProgressClick = (ev) => {
      const post = {...this.props.post};
      const duration = this.state.player.duration > 0 ?
          this.state.player.duration : post.props.duration / 1000;
      const rect = ev.target.getBoundingClientRect();
      const seekPos = ev.clientX - rect.left;
      const seekValue = (seekPos / rect.width);
      const seekTime = (duration * seekValue);
      const progress = Math.round((seekTime / duration) * 100);
      const {player} = {...this.state};

      player.currentTime = seekTime;
      this.setState({player, progress});
  }

  changePlaybackRate = () => {
      const rates = [1, 1.25, 1.5, 1.75, 2];
      const currentIndex = rates.indexOf(this.state.playbackRate);
      const nextIndex = (currentIndex + 1) % rates.length;
      const newRate = rates[nextIndex];

      this.setState({playbackRate: newRate}, () => {
          if (this.state.player) {
              this.state.player.playbackRate = newRate;
          }
      });
  }

  render() {
      const post = {...this.props.post};

      let playIcon;

      const theme = this.props.theme;

      const hoverCss = css`
          &:hover {
            color: ${theme.linkColor};
          }
        `;

      if (this.state.playing) {
          playIcon = <i onClick={this.pause} css={hoverCss} className='fa fa-pause'/>;
      } else {
          playIcon = <i onClick={this.play} css={hoverCss} className='fa fa-play'/>;
      }

      let playbackInfo = '0:00';

      if (this.state.played) {
          playbackInfo = this.state.currentTime;
      } else {
          playbackInfo = this.state.duration;
      }

      const playerStyle = {
          backgroundColor: theme.centerChannelBg,
          color: changeOpacity(theme.centerChannelColor, 0.7),
          border: '1px solid ' + changeOpacity(theme.centerChannelColor, 0.2),
      };

      const progressCss = css`
          -webkit-appearance: none;
          -moz-appearance: none;
          background: ${changeOpacity(theme.centerChannelColor, 0.1)};
          color: ${theme.linkColor};
          border: 1px solid ${changeOpacity(theme.centerChannelColor, 0.1)};
          &::-moz-progress-bar {
            background: ${theme.linkColor};
          }
          &::-webkit-progress-bar {
            background: ${changeOpacity(theme.centerChannelColor, 0.1)};
          }
          &::-webkit-progress-value {
            background: ${theme.linkColor};
          }
        `;

      const buttonStyle = {
          width: '12px',
      };

      const playbackRateButton = (
          <button onClick={this.changePlaybackRate} css={hoverCss} className='speed-button'>
              {this.state.playbackRate}x
          </button>
      );

      return (
          <div>
              <div
                  className='voice-player'
                  style={playerStyle}
              >

                  <div style={buttonStyle}>
                      <button className='voice-player-playbutton'>
                          { playIcon }
                      </button>
                  </div>
                  <progress
                      onClick={this.onProgressClick}
                      css={progressCss}
                      className='voice-player-progress'
                      min='0'
                      max='100'
                      value={this.state.progress}
                  />
                  <span>{ playbackInfo }</span>
                  {playbackRateButton}
              </div>
              <audio
                  id={'voice_' + post.id}
                  preload='none'
              >
                  <source
                      src={`${this.props.pluginURL}/recordings/${post.id}`}
                      type='audio/mpeg'
                  />
              </audio>
          </div>
      );
  }
}
