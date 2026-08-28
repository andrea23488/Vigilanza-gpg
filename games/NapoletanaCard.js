import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
} from 'react-native';

import Svg, {
  Circle,
  Ellipse,
  Line,
  Path,
  Rect,
  G,
  Polygon,
  Text as SvgText,
} from 'react-native-svg';



function Denaro({ x = 30, y = 30, scale = 1 }) {
  return (
    <G transform={`translate(${x} ${y}) scale(${scale})`}>
      <Circle
        cx="0"
        cy="0"
        r="12"
        fill="#E6B93E"
        stroke="#8D6414"
        strokeWidth="2"
      />

      <Circle
        cx="0"
        cy="0"
        r="8.5"
        fill="#F9E49A"
        stroke="#B98B22"
        strokeWidth="1.4"
      />

      <Path
        d="M 0 -6 L 3 -2 L 7 0 L 3 2 L 0 6 L -3 2 L -7 0 L -3 -2 Z"
        fill="#D29D22"
      />

      <Circle
        cx="0"
        cy="0"
        r="2.5"
        fill="#FFF2B7"
        stroke="#A87614"
        strokeWidth="1"
      />
    </G>
  );
}


function Coppa({ x = 30, y = 30, scale = 1 }) {
  return (
    <G transform={`translate(${x} ${y}) scale(${scale})`}>

      <Ellipse
        cx="0"
        cy="-10"
        rx="11"
        ry="4"
        fill="#D95A4F"
        stroke="#752D29"
        strokeWidth="1.6"
      />

      <Path
        d="
          M -10 -9
          Q -9 4 -4 9
          Q 0 13 4 9
          Q 9 4 10 -9
          Z
        "
        fill="#C8463F"
        stroke="#752D29"
        strokeWidth="1.8"
      />

      <Path
        d="M -6 -6 Q 0 -1 6 -6"
        fill="none"
        stroke="#F18A7F"
        strokeWidth="2"
      />

      <Line
        x1="0"
        y1="11"
        x2="0"
        y2="19"
        stroke="#8A342F"
        strokeWidth="3"
      />

      <Path
        d="M -8 19 Q 0 15 8 19"
        fill="none"
        stroke="#8A342F"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </G>
  );
}


function Spada({ x = 30, y = 30, scale = 1, rotate = 0 }) {
  return (
    <G
      transform={`translate(${x} ${y}) rotate(${rotate}) scale(${scale})`}
    >

      <Path
        d="
          M 0 -21
          L 5 -6
          L 2 7
          L -2 7
          L -5 -6
          Z
        "
        fill="#AAB8C7"
        stroke="#3E5368"
        strokeWidth="1.6"
      />

      <Path
        d="M 0 -18 L 0 5"
        stroke="#E8EEF4"
        strokeWidth="1.2"
      />

      <Line
        x1="-8"
        y1="7"
        x2="8"
        y2="7"
        stroke="#C79A37"
        strokeWidth="3"
        strokeLinecap="round"
      />

      <Line
        x1="0"
        y1="8"
        x2="0"
        y2="18"
        stroke="#704C2E"
        strokeWidth="4"
        strokeLinecap="round"
      />

      <Circle
        cx="0"
        cy="20"
        r="3.2"
        fill="#D5A840"
        stroke="#7A5B20"
        strokeWidth="1"
      />
    </G>
  );
}


function Bastone({ x = 30, y = 30, scale = 1, rotate = 0 }) {
  return (
    <G
      transform={`translate(${x} ${y}) rotate(${rotate}) scale(${scale})`}
    >

      <Path
        d="
          M -4 -20
          Q -9 -11 -5 -3
          Q -1 5 -5 13
          Q -6 18 0 22
          Q 5 16 3 9
          Q 1 3 5 -5
          Q 9 -13 4 -20
          Z
        "
        fill="#76934B"
        stroke="#40552E"
        strokeWidth="2"
      />

      <Path
        d="M -1 -15 Q -8 -13 -9 -7"
        fill="none"
        stroke="#A8BE76"
        strokeWidth="2"
        strokeLinecap="round"
      />

      <Path
        d="M 1 0 Q 8 -2 9 4"
        fill="none"
        stroke="#A8BE76"
        strokeWidth="2"
        strokeLinecap="round"
      />

      <Path
        d="M -2 11 Q -9 10 -8 16"
        fill="none"
        stroke="#A8BE76"
        strokeWidth="2"
        strokeLinecap="round"
      />

      <Circle
        cx="0"
        cy="-8"
        r="2"
        fill="#B4C987"
      />

      <Circle
        cx="1"
        cy="8"
        r="2"
        fill="#B4C987"
      />

    </G>
  );
}


function SuitSymbol({
  seme,
  x,
  y,
  scale = 1,
  rotate = 0,
}) {
  if (seme === 'denari') {
    return <Denaro x={x} y={y} scale={scale} />;
  }

  if (seme === 'coppe') {
    return <Coppa x={x} y={y} scale={scale} />;
  }

  if (seme === 'spade') {
    return (
      <Spada
        x={x}
        y={y}
        scale={scale}
        rotate={rotate}
      />
    );
  }

  return (
    <Bastone
      x={x}
      y={y}
      scale={scale}
      rotate={rotate}
    />
  );
}


const POSIZIONI = {
  1: [[50, 60]],
  2: [[50, 33], [50, 87]],
  3: [[50, 25], [50, 60], [50, 95]],
  4: [[31, 32], [69, 32], [31, 88], [69, 88]],
  5: [[30, 29], [70, 29], [50, 60], [30, 91], [70, 91]],
  6: [[30, 25], [70, 25], [30, 60], [70, 60], [30, 95], [70, 95]],
  7: [[30, 23], [70, 23], [50, 43], [30, 63], [70, 63], [30, 97], [70, 97]],
};



function getSemeStyle(seme) {
  const map = {
    denari: {
      color: '#D6A823',
      light: '#F3D66E',
    },
    coppe: {
      color: '#BD403A',
      light: '#E7776F',
    },
    spade: {
      color: '#516D86',
      light: '#9DB4C8',
    },
    bastoni: {
      color: '#607D3E',
      light: '#9AB66B',
    },
  };

  return map[String(seme || '').toLowerCase()] || {
    color: '#777777',
    light: '#BBBBBB',
  };
}


function FanteFigura({ carta }) {
  const seme = getSemeStyle(carta.seme);

  return (
    <G>

      <Polygon
        points="35,25 42,15 50,23 58,15 65,25 61,31 39,31"
        fill={seme.light}
        stroke={seme.color}
        strokeWidth="1.4"
      />

      <Circle
        cx="50"
        cy="42"
        r="10"
        fill="#F1C5A1"
        stroke="#9E7254"
        strokeWidth="1.3"
      />

      <Path
        d="M37 56 Q50 48 63 56 L59 91 L41 91 Z"
        fill="#4868A8"
        stroke="#263F78"
        strokeWidth="1.5"
      />

      <Path
        d="M38 59 L29 79"
        stroke="#B43F45"
        strokeWidth="5"
        strokeLinecap="round"
      />

      <Path
        d="M62 59 L72 77"
        stroke="#B43F45"
        strokeWidth="5"
        strokeLinecap="round"
      />

      <Circle
        cx="28"
        cy="80"
        r="3.5"
        fill="#F1C5A1"
      />

      <Circle
        cx="73"
        cy="78"
        r="3.5"
        fill="#F1C5A1"
      />

      <Rect
        x="41"
        y="80"
        width="18"
        height="5"
        rx="2"
        fill="#D8AE35"
      />

      <Line
        x1="45"
        y1="90"
        x2="41"
        y2="109"
        stroke="#304B88"
        strokeWidth="4"
        strokeLinecap="round"
      />

      <Line
        x1="55"
        y1="90"
        x2="59"
        y2="109"
        stroke="#304B88"
        strokeWidth="4"
        strokeLinecap="round"
      />

      <Line
        x1="68"
        y1="79"
        x2="79"
        y2="100"
        stroke="#9DACBC"
        strokeWidth="2"
      />

      <Line
        x1="65"
        y1="82"
        x2="73"
        y2="76"
        stroke="#C4932B"
        strokeWidth="2"
      />

      <Circle
        cx="50"
        cy="101"
        r="12"
        fill="#FFF8E9"
        stroke={seme.color}
        strokeWidth="1.4"
      />

      <SuitSymbol
        seme={carta.seme}
        x={50}
        y={101}
        scale={0.62}
      />

    </G>
  );
}


function CavalloFigura({ carta }) {
  const seme = getSemeStyle(carta.seme);

  return (
    <G>

      <Path
        d="
          M20 87
          Q27 67 44 65
          Q59 63 69 73
          Q75 79 76 89
          L68 90
          Q65 82 57 80
          Q49 88 38 88
          L30 87
          Q27 94 26 103
          L20 103
          Z
        "
        fill="#D6C3A5"
        stroke="#725941"
        strokeWidth="1.7"
      />

      <Path
        d="
          M57 67
          Q62 50 73 51
          Q82 55 76 67
          Q68 70 57 67
        "
        fill="#D6C3A5"
        stroke="#725941"
        strokeWidth="1.7"
      />

      <Circle
        cx="74"
        cy="56"
        r="1.8"
        fill="#222222"
      />

      <Path
        d="M69 52 Q75 43 80 49"
        fill="none"
        stroke="#725941"
        strokeWidth="2"
      />

      <Line
        x1="31"
        y1="88"
        x2="29"
        y2="110"
        stroke="#725941"
        strokeWidth="3.5"
      />

      <Line
        x1="45"
        y1="88"
        x2="44"
        y2="110"
        stroke="#725941"
        strokeWidth="3.5"
      />

      <Line
        x1="58"
        y1="88"
        x2="60"
        y2="110"
        stroke="#725941"
        strokeWidth="3.5"
      />

      <Circle
        cx="43"
        cy="38"
        r="9"
        fill="#F1C5A1"
        stroke="#9E7254"
        strokeWidth="1.2"
      />

      <Polygon
        points="34,31 52,31 49,23 38,22"
        fill={seme.light}
        stroke={seme.color}
        strokeWidth="1.4"
      />

      <Path
        d="M34 49 Q43 43 53 49 L56 69 L31 69 Z"
        fill="#4868A8"
        stroke="#263F78"
        strokeWidth="1.5"
      />

      <Line
        x1="52"
        y1="51"
        x2="67"
        y2="38"
        stroke="#B43F45"
        strokeWidth="4"
        strokeLinecap="round"
      />

      <Line
        x1="67"
        y1="38"
        x2="77"
        y2="23"
        stroke="#9DACBC"
        strokeWidth="2"
      />

      <Line
        x1="39"
        y1="69"
        x2="35"
        y2="82"
        stroke="#304B88"
        strokeWidth="4"
        strokeLinecap="round"
      />

      <Line
        x1="50"
        y1="69"
        x2="53"
        y2="81"
        stroke="#304B88"
        strokeWidth="4"
        strokeLinecap="round"
      />

      <Circle
        cx="20"
        cy="25"
        r="11"
        fill="#FFF8E9"
        stroke={seme.color}
        strokeWidth="1.3"
      />

      <SuitSymbol
        seme={carta.seme}
        x={20}
        y={25}
        scale={0.58}
      />

    </G>
  );
}


function ReFigura({ carta }) {
  const seme = getSemeStyle(carta.seme);

  return (
    <G>

      <Polygon
        points="
          36,27
          40,15
          48,24
          54,14
          61,24
          66,16
          65,29
        "
        fill="#E2BA42"
        stroke="#997522"
        strokeWidth="1.5"
      />

      <Circle
        cx="50"
        cy="41"
        r="10"
        fill="#F1C5A1"
        stroke="#9E7254"
        strokeWidth="1.2"
      />

      <Path
        d="
          M29 59
          Q50 45 71 59
          L64 109
          L36 109
          Z
        "
        fill="#B83B4A"
        stroke="#7A2431"
        strokeWidth="1.6"
      />

      <Path
        d="
          M40 58
          Q50 51 60 58
          L57 104
          L43 104
          Z
        "
        fill="#F1E7CD"
        stroke="#B8A67D"
        strokeWidth="1.2"
      />

      <Line
        x1="50"
        y1="59"
        x2="50"
        y2="101"
        stroke="#C89A2C"
        strokeWidth="1.6"
      />

      <Circle cx="50" cy="70" r="1.8" fill="#C89A2C" />
      <Circle cx="50" cy="79" r="1.8" fill="#C89A2C" />
      <Circle cx="50" cy="88" r="1.8" fill="#C89A2C" />

      <Line
        x1="39"
        y1="65"
        x2="27"
        y2="84"
        stroke="#B83B4A"
        strokeWidth="5"
        strokeLinecap="round"
      />

      <Line
        x1="61"
        y1="65"
        x2="73"
        y2="84"
        stroke="#B83B4A"
        strokeWidth="5"
        strokeLinecap="round"
      />

      <Circle
        cx="26"
        cy="85"
        r="3.5"
        fill="#F1C5A1"
      />

      <Circle
        cx="74"
        cy="85"
        r="3.5"
        fill="#F1C5A1"
      />

      <Line
        x1="74"
        y1="85"
        x2="74"
        y2="111"
        stroke="#C89A2C"
        strokeWidth="2.7"
      />

      <Circle
        cx="74"
        cy="80"
        r="4"
        fill="#E2BA42"
        stroke="#997522"
        strokeWidth="1"
      />

      <Circle
        cx="50"
        cy="96"
        r="12"
        fill="#FFF8E9"
        stroke={seme.color}
        strokeWidth="1.4"
      />

      <SuitSymbol
        seme={carta.seme}
        x={50}
        y={96}
        scale={0.60}
      />

    </G>
  );
}


function Figura({ carta }) {
  return (
    <Svg
      viewBox="0 0 100 120"
      width="100%"
      height="100%"
    >

      <Rect
        x="2"
        y="2"
        width="96"
        height="116"
        rx="8"
        fill="#FFF8E9"
        stroke="#D1C099"
        strokeWidth="1.5"
      />

      {carta.valore === 8 && (
        <FanteFigura carta={carta} />
      )}

      {carta.valore === 9 && (
        <CavalloFigura carta={carta} />
      )}

      {carta.valore === 10 && (
        <ReFigura carta={carta} />
      )}

    </Svg>
  );
}


function FronteCarta({ carta }) {
  if (carta.valore >= 8) {
    return <Figura carta={carta} />;
  }

  const posizioni =
    POSIZIONI[carta.valore] || POSIZIONI[1];

  return (
    <Svg
      viewBox="0 0 100 120"
      width="100%"
      height="100%"
    >
      <Rect
        x="2"
        y="2"
        width="96"
        height="116"
        rx="8"
        fill="#FFF8E9"
        stroke="#D1C099"
        strokeWidth="1.5"
      />

      {carta.valore === 1 ? (
        <>
          <Circle
            cx="50"
            cy="60"
            r="25"
            fill="#F8F0D8"
            stroke="#D2BE91"
            strokeWidth="1.2"
          />

          <SuitSymbol
            seme={carta.seme}
            x={50}
            y={60}
            scale={1.55}
            rotate={0}
          />

          <Circle
            cx="50"
            cy="60"
            r="31"
            fill="none"
            stroke="#E6D8B5"
            strokeWidth="1"
          />
        </>
      ) : (
        posizioni.map(([x, y], index) => (
          <SuitSymbol
            key={index}
            seme={carta.seme}
            x={x}
            y={y}
            scale={carta.valore >= 6 ? 0.62 : 0.74}
            rotate={
              carta.seme === 'spade' ||
              carta.seme === 'bastoni'
                ? index % 2 === 0
                  ? -12
                  : 12
                : 0
            }
          />
        ))
      )}
    </Svg>
  );
}


export default function NapoletanaCard({
  carta,
  coperta = false,
  onPress,
  disabled = false,
  piccola = false,
}) {
  const width = piccola ? 68 : 86;
  const height = piccola ? 104 : 132;

  const content = coperta ? (
    <View
      style={{
        flex: 1,
        borderRadius: 10,
        backgroundColor: '#1E4898',
        borderWidth: 2,
        borderColor: '#82B6FF',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          position: 'absolute',
          top: 5,
          left: 5,
          right: 5,
          bottom: 5,
          borderRadius: 7,
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.65)',
        }}
      />

      <Text
        style={{
          color: '#FFFFFF',
          fontSize: piccola ? 15 : 19,
          fontWeight: '900',
        }}
      >
        ✦
      </Text>

      <Text
        style={{
          color: '#D9E9FF',
          fontSize: piccola ? 7 : 9,
          fontWeight: '900',
          letterSpacing: 1,
          marginTop: 4,
        }}
      >
        BRISCOLA
      </Text>

      <Text
        style={{
          color: '#FFFFFF',
          fontSize: piccola ? 15 : 19,
          fontWeight: '900',
          marginTop: 3,
        }}
      >
        ✦
      </Text>
    </View>
  ) : (
    <View
      style={{
        flex: 1,
        borderRadius: 10,
        backgroundColor: '#FFF8E9',
        overflow: 'hidden',
      }}
    >
      <FronteCarta carta={carta} />

      {/* Nome del seme sempre visibile */}
      <View
        style={{
          position: 'absolute',
          left: 5,
          right: 5,
          bottom: 4,
          minHeight: piccola ? 15 : 18,
          borderRadius: 6,
          backgroundColor: 'rgba(255,248,233,0.94)',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text
          numberOfLines={1}
          style={{
            color: '#3D3D3D',
            fontSize: piccola ? 7 : 9,
            fontWeight: '900',
            letterSpacing: 0.25,
          }}
        >
          {carta.semeNome ||
            (carta.seme === 'denari'
              ? 'Denari'
              : carta.seme === 'coppe'
              ? 'Coppe'
              : carta.seme === 'spade'
              ? 'Spade'
              : carta.seme === 'bastoni'
              ? 'Bastoni'
              : '')}
        </Text>
      </View>

      <View
        style={{
          position: 'absolute',
          top: 5,
          left: 6,
          right: 6,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Text
          numberOfLines={1}
          style={{
            color: '#282828',
            fontSize: piccola ? 8 : 10,
            fontWeight: '900',
          }}
        >
          {carta.valore >= 8
            ? `${carta.valore} ${carta.nome}`
            : carta.nome}
        </Text>
      </View>
    </View>
  );

  if (!onPress) {
    return (
      <View
        style={{
          width,
          height,
          marginHorizontal: 4,
          borderRadius: 11,
          backgroundColor: '#FFF8E9',
          shadowColor: '#000',
          shadowOpacity: 0.18,
          shadowRadius: 5,
          shadowOffset: {
            width: 0,
            height: 3,
          },
        }}
      >
        {content}
      </View>
    );
  }

  return (
    <TouchableOpacity
      activeOpacity={0.76}
      disabled={disabled}
      onPress={onPress}
      style={{
        width,
        height,
        marginHorizontal: 4,
        borderRadius: 11,
        opacity: disabled ? 0.48 : 1,
        shadowColor: '#000',
        shadowOpacity: 0.18,
        shadowRadius: 5,
        shadowOffset: {
          width: 0,
          height: 3,
        },
      }}
    >
      {content}
    </TouchableOpacity>
  );
}
