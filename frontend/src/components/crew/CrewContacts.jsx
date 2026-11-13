// '연락처' 탭: 국별로 묶은 명단. 오른쪽 파란 동그라미를 누르면 바로 전화가 걸린다.
import { useMemo, useState } from "react";
import { Avatar, Icon, StatusIcon } from "./CrewKit";
import { useCrew } from "./crewContext";
import { deptColor, matchesQuery, smsHref, statusOf, telHref } from "./crewUtils";

const ROLE_RANK = { 회장: 0, 부회장: 1, 국장: 2, 차장: 3 };

export default function CrewContacts() {
  const { members, me, openPerson, openMember } = useCrew();
  const [query, setQuery] = useState("");
  const [dept, setDept] = useState("ALL");

  const depts = useMemo(() => {
    const seen = [];
    members.forEach((member) => {
      const name = member.dept || "회장단";
      if (!seen.includes(name)) seen.push(name);
    });
    return seen;
  }, [members]);

  const groups = useMemo(() => {
    const map = new Map();
    members
      .filter((member) => (dept === "ALL" || (member.dept || "회장단") === dept) && matchesQuery(member, query))
      .forEach((member) => {
        const name = member.dept || "회장단";
        if (!map.has(name)) map.set(name, []);
        map.get(name).push(member);
      });
    return [...map.entries()].map(([name, list]) => [
      name,
      [...list].sort((a, b) => (ROLE_RANK[a.role] ?? 9) - (ROLE_RANK[b.role] ?? 9) || a.sortOrder - b.sortOrder),
    ]);
  }, [members, dept, query]);

  const count = groups.reduce((sum, [, list]) => sum + list.length, 0);

  return (
    <div className="crew-contacts">
      <div className="crew-sticky">
        <label className="crew-search">
          <Icon.search size={18} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="이름 · 초성 · 번호 뒷자리"
            inputMode="search"
          />
          {query ? (
            <button type="button" className="crew-search__clear" onClick={() => setQuery("")} aria-label="지우기">
              <Icon.close size={16} />
            </button>
          ) : null}
        </label>
        <div className="crew-filter crew-filter--scroll" role="tablist" aria-label="국">
          <button type="button" role="tab" aria-selected={dept === "ALL"} className={`crew-filter__chip${dept === "ALL" ? " is-on" : ""}`} onClick={() => setDept("ALL")}>
            전체
          </button>
          {depts.map((name) => (
            <button
              key={name}
              type="button"
              role="tab"
              aria-selected={dept === name}
              className={`crew-filter__chip crew-filter__chip--dept${dept === name ? " is-on" : ""}`}
              style={{ "--c": deptColor(name === "회장단" ? "" : name) }}
              onClick={() => setDept(dept === name ? "ALL" : name)}
            >
              {name}
            </button>
          ))}
        </div>
      </div>

      {count === 0 ? <p className="crew-empty">맞는 사람이 없어요. 이름을 다시 확인해 주세요.</p> : null}

      {groups.map(([name, list]) => (
        <section key={name} className="crew-dept" style={{ "--dept": deptColor(name === "회장단" ? "" : name) }}>
          <h2 className="crew-dept__name">{name}<span>{list.length}명</span></h2>
          <ul className="crew-dept__list">
            {list.map((member) => {
              const status = statusOf(member.status);
              return (
                <li key={member.id} className="crew-contact">
                  <button type="button" className="crew-contact__main" onClick={() => openPerson(member.name)}>
                    <Avatar member={member} size={42} />
                    <span className="crew-contact__text">
                      <span className="crew-contact__name">
                        {member.name}
                        {member.role && member.role !== "국원" ? <em className="crew-role">{member.role}</em> : null}
                        {member.name === me.name ? <em className="crew-me-tag">나</em> : null}
                      </span>
                      <span className="crew-contact__phone">{member.phone}</span>
                    </span>
                    {status.key ? (
                      <span className="crew-contact__status" style={{ color: status.color }} title={status.label}>
                        <StatusIcon status={status.key} size={16} />
                      </span>
                    ) : null}
                  </button>
                  <a className="crew-sms" href={smsHref(member.phone)} aria-label={`${member.name}에게 문자`}>
                    <Icon.message size={17} />
                  </a>
                  <a className="crew-call" href={telHref(member.phone)} aria-label={`${member.name}에게 전화`}>
                    <Icon.phone size={18} />
                  </a>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <button type="button" className="crew-btn crew-btn--dashed crew-btn--block" onClick={() => openMember({})}>
        <Icon.plus size={18} /> 명단에 사람 더하기
      </button>
    </div>
  );
}
